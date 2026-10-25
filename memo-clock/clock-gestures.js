/* Pointer, trackpad and Safari gestures share one recognizer. */
(() => {
  'use strict';
  class ClockGestures {
    constructor(surface,options={}){
      this.surface=surface;this.o=options;this.points=new Map();this.single=null;this.pinch=null;this.multi=false;
      this.wheelSum=0;this.wheelAt=-Infinity;this.wheelUsed=false;this.wheelLastDelta=0;this.wheelFiredAt=-Infinity;this.bindings=[];
      const listen=(name,fn)=>{const handler=fn.bind(this);surface.addEventListener(name,handler,{passive:false});this.bindings.push([name,handler]);};
      listen('pointerdown',this.down);listen('pointermove',this.move);listen('pointerup',this.up);
      listen('pointercancel',this.cancel);listen('lostpointercapture',this.cancel);
      listen('wheel',this.wheel);listen('gesturestart',this.gestureStart);listen('gesturechange',this.gestureChange);listen('gestureend',this.gestureEnd);
    }
    now(){return this.o.now?this.o.now():performance.now();}
    ignored(e){return Boolean(e.target.closest?.('[data-native-scroll],[data-gesture-ignore],textarea,input,a'));}
    prevent(e){if(e.cancelable)e.preventDefault();}
    hint(text='Swipe ↑ ↓ · Pinch'){this.o.onHint?.(text);}
    preview(scale=1,dy=0,active=false){this.o.onPreview?.({scale,dy,active});}
    suppress(){this.o.onSuppressClick?.();}
    geometry(){const [a,b]=[...this.points.values()];return {distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
    down(e){
      if(this.ignored(e)||e.button>0)return;
      this.points.set(e.pointerId,{x:e.clientX,y:e.clientY});
      try{const capture=e.target.closest?.('.clock')||this.surface;capture.setPointerCapture(e.pointerId);}catch(_){/* Safari may already have cancelled capture. */}
      if(this.points.size===1&&!this.multi){this.single={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0};}
      else if(this.points.size===2){
        this.prevent(e);this.multi=true;this.single=null;this.suppress();
        const g=this.geometry();this.pinch={initial:Math.max(40,g.distance),origin:{x:g.x,y:g.y},armed:false,committed:false};
        this.hint('Pinch → Mix');
      }else if(this.points.size>2){this.pinch=null;this.preview();}
    }
    updatePinch(scale,origin){
      if(!this.pinch||this.pinch.committed)return;
      this.pinch.origin=origin;
      const enough=scale<=.78&&this.pinch.initial*(1-scale)>=28;
      this.pinch.armed=enough;
      this.preview(Math.max(.58,Math.min(1.05,scale)),0,true);
      this.hint(enough?'Release → Mix':'Pinch → Mix');
    }
    move(e){
      if(!this.points.has(e.pointerId))return;
      this.points.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.points.size===2&&this.pinch){
        this.prevent(e);const g=this.geometry();this.updatePinch(g.distance/this.pinch.initial,{x:g.x,y:g.y});return;
      }
      if(this.multi||!this.single||this.single.id!==e.pointerId)return;
      const s=this.single;s.dx=e.clientX-s.x;s.dy=e.clientY-s.y;
      if(Math.abs(s.dy)>12&&Math.abs(s.dy)>Math.abs(s.dx)*1.2){
        this.prevent(e);this.preview(1,Math.max(-22,Math.min(22,s.dy*.18)),true);this.hint(s.dy<0?'Previous ↑':'Next ↓');
      }
    }
    commitPinch(){
      const p=this.pinch;if(!p||p.committed)return;
      p.committed=true;
      if(p.armed)this.o.onMix?.(p.origin);
    }
    up(e){
      if(!this.points.has(e.pointerId))return;
      if(this.multi){this.suppress();this.commitPinch();}
      else if(this.single?.id===e.pointerId){
        const {dx,dy}=this.single;
        if(Math.abs(dy)>58&&Math.abs(dy)>Math.abs(dx)*1.2){this.suppress();this.o.onDay?.(dy<0?-1:1);}
        else if(Math.abs(dx)>40){this.suppress();this.o.onRipple?.();}
        else if(Math.max(Math.abs(dx),Math.abs(dy))>12)this.suppress();
      }
      this.points.delete(e.pointerId);this.single=null;this.preview();this.hint();
      if(!this.points.size){this.multi=false;this.pinch=null;}
    }
    cancel(e){
      if(!this.points.has(e.pointerId))return;
      this.points.delete(e.pointerId);this.single=null;this.pinch=null;this.preview();this.hint();
      // A remaining finger after a cancelled pinch must not become a swipe.
      if(!this.points.size)this.multi=false;
    }
    wheel(e){
      if(this.ignored(e))return;
      if(e.ctrlKey){
        this.prevent(e);
        if(!this.wheelPinch){this.wheelPinch={scale:1};this.pinch={initial:180,origin:{x:e.clientX,y:e.clientY},armed:false,committed:false};}
        this.wheelPinch.scale*=Math.exp(-e.deltaY*.01);
        this.updatePinch(this.wheelPinch.scale,{x:e.clientX,y:e.clientY});
        clearTimeout(this.wheelTimer);
        this.wheelTimer=setTimeout(()=>{this.commitPinch();this.wheelPinch=null;this.pinch=null;this.preview();this.hint();},160);return;
      }
      if(Math.abs(e.deltaY)<Math.abs(e.deltaX))return;
      const dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?this.surface.clientHeight:1);
      if(!dy)return;
      this.prevent(e);const now=this.now();
      // Keep a flick's momentum on one day, but accept a fresh flick before its tail ends.
      const reversed=Math.abs(dy)>=4&&Math.sign(dy)!==Math.sign(this.wheelLastDelta);
      const freshFlick=this.wheelUsed&&now-this.wheelFiredAt>=280&&Math.abs(dy)>=12&&Math.abs(dy)>Math.abs(this.wheelLastDelta)*1.8;
      if(now-this.wheelAt>160||reversed||freshFlick){this.wheelSum=0;this.wheelUsed=false;}
      this.wheelAt=now;this.wheelLastDelta=dy;
      if(this.wheelUsed)return;
      this.wheelSum+=dy;
      // Positive wheel movement raises the content, matching an upward touch swipe.
      if(Math.abs(this.wheelSum)>=48){this.wheelUsed=true;this.wheelFiredAt=now;this.suppress();this.o.onDay?.(this.wheelSum>0?-1:1);}
    }
    gestureStart(e){
      if(this.ignored(e))return;
      this.prevent(e);
      // iPad can emit these alongside PointerEvents. Only one recognizer owns it.
      if(this.points.size>=2)return;
      this.nativePinch=true;this.pinch={initial:180,origin:{x:e.clientX,y:e.clientY},armed:false,committed:false};
    }
    gestureChange(e){
      this.prevent(e);if(!this.nativePinch)return;
      this.updatePinch(e.scale,{x:e.clientX,y:e.clientY});
    }
    gestureEnd(e){
      this.prevent(e);if(!this.nativePinch)return;
      this.suppress();this.commitPinch();this.nativePinch=false;this.pinch=null;this.preview();this.hint();
    }
    destroy(){for(const [name,fn]of this.bindings)this.surface.removeEventListener(name,fn);clearTimeout(this.wheelTimer);this.points.clear();}
  }
  window.ClockGestures=ClockGestures;
})();
