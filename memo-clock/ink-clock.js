/* Sharp contour lines on a deformable signed-distance field. No blur or flap. */
(() => {
  'use strict';
  const W=180,H=272,NS='http://www.w3.org/2000/svg';
  const contourLevels=[-6,-2.5,1,5.5];
  const fields=new Map(),artwork=new Map();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const ease=t=>t*t*(3-2*t);
  function distance(mask,inside){
    const d=new Float32Array(W*H),q=Math.SQRT2;
    for(let i=0;i<d.length;i++)d[i]=Boolean(mask[i])===inside?0:999;
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
      const i=y*W+x;d[i]=Math.min(d[i],d[i-1]+1,d[i-W]+1,d[i-W-1]+q,d[i-W+1]+q);
    }
    for(let y=H-2;y>0;y--)for(let x=W-2;x>0;x--){
      const i=y*W+x;d[i]=Math.min(d[i],d[i+1]+1,d[i+W]+1,d[i+W+1]+q,d[i+W-1]+q);
    }
    return d;
  }
  // Each numeral is drawn as a continuous, deliberately asymmetric gesture.
  const strokes=[
    'M85 43 C40 37 36 95 38 146 C38 197 48 231 87 231 C133 231 141 177 140 123 C139 75 129 39 85 43Z',
    'M48 83 Q78 64 95 42 L94 230 M59 230 L130 230',
    'M40 80 C48 33 123 26 136 75 C153 132 67 145 42 226 L139 227',
    'M42 53 C89 30 137 42 133 87 C130 119 98 130 76 129 C123 121 148 150 134 194 C122 235 66 244 39 216',
    'M123 231 L126 44 L38 173 L146 172',
    'M139 45 L48 45 L41 130 C77 110 137 121 138 170 C141 229 82 246 40 218',
    'M130 48 C77 23 36 82 39 162 C37 205 58 231 91 231 C144 231 151 174 128 143 C108 116 65 123 41 154',
    'M37 45 L143 44 C118 97 81 154 67 231',
    'M89 132 C27 111 29 39 88 41 C152 42 148 110 89 132 C16 157 27 235 89 231 C154 232 158 157 89 132Z',
    'M139 122 C117 150 65 148 44 117 C19 81 42 37 87 41 C130 40 142 84 140 133 C137 191 115 244 50 222'
  ];
  const hash=(x,y,seed)=>{const n=Math.sin(x*127.1+y*311.7+seed*73.17)*43758.5453;return n-Math.floor(n);};
  function noise(x,y,seed){
    const ix=Math.floor(x),iy=Math.floor(y),u=ease(x-ix),v=ease(y-iy);
    return ((hash(ix,iy,seed)*(1-u)+hash(ix+1,iy,seed)*u)*(1-v)+(hash(ix,iy+1,seed)*(1-u)+hash(ix+1,iy+1,seed)*u)*v)*2-1;
  }
  function fieldFor(value){
    if(fields.has(value))return fields.get(value);
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
    const c=canvas.getContext('2d',{willReadFrequently:true});
    c.strokeStyle='#000';c.lineWidth=value==='1'?29:27;c.lineCap='round';c.lineJoin='round';
    c.stroke(new Path2D(strokes[Number(value)]));
    const pixels=c.getImageData(0,0,W,H).data,mask=new Uint8Array(W*H),phase=Number(value)*1.71;
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
      const dx=5*Math.sin(y*.043+phase)+2.4*Math.sin(y*.11+x*.025+phase);
      const dy=3*Math.sin(x*.061+y*.027+phase)+2*Math.cos(y*.12-x*.033);
      const sx=clamp(Math.round(x+dx),0,W-1),sy=clamp(Math.round(y+dy),0,H-1);
      mask[y*W+x]=pixels[(sy*W+sx)*4+3]>127?1:0;
    }
    const outer=distance(mask,true),inner=distance(mask,false),field=new Float32Array(W*H);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      // Coherent, small-scale erosion makes islands and narrow channels. The
      // contour remains a single precise vector line, with no opacity texture.
      const broad=8.4*noise(x*.047,y*.047,phase)+3.6*noise(x*.095,y*.095,phase+5);
      const detail=2.2*noise(x*.28,y*.28,phase+8)+.65*noise(x*.64,y*.64,phase+11);
      const density=1.15+.55*noise(x*.023,y*.023,phase+19);
      field[y*W+x]=(outer[y*W+x]-inner[y*W+x]+broad+detail)*density;
    }
    // A handful of holes and detached ink contours, rather than a uniform
    // stack of outlines around a font. Their locations stay stable per digit.
    let holes=0,islands=0;
    for(let n=0;n<130&&(holes<3||islands<3);n++){
      const x=20+Math.floor(hash(n,1,phase)*140),y=25+Math.floor(hash(n,2,phase)*220),value=field[y*W+x];
      const hole=value < -5&&value > -12&&holes<3, island=value>12&&value<18&&islands<3;
      if(!hole&&!island)continue;
      if(hole)holes++;else islands++;
      const radius=hole?2.5:1.2;
      for(let yy=Math.max(0,y-7);yy<Math.min(H,y+8);yy++)for(let xx=Math.max(0,x-7);xx<Math.min(W,x+8);xx++){
        const d=Math.hypot(xx-x,yy-y),i=yy*W+xx;
        field[i]=hole?Math.max(field[i],(radius-d)*2):Math.min(field[i],(d-radius)*3);
      }
    }
    fields.set(value,field);return field;
  }
  const cases=[[],[[3,0]],[[0,1]],[[3,1]],[[1,2]],[[3,0],[1,2]],[[0,2]],[[3,2]],[[2,3]],[[0,2]],[[0,1],[2,3]],[[1,2]],[[1,3]],[[0,1]],[[3,0]],[]];
  function contours(field,w,h,step=1,offset=0,levels=contourLevels){
    let all='';const f=n=>n.toFixed(1);
    for(const level of levels){
      const vertices=new Map();
      for(let y=1;y<h-2;y++)for(let x=1;x<w-2;x++){
        const i=y*w+x,v=[field[i],field[i+1],field[i+w+1],field[i+w]];
        const code=(v[0]<level?1:0)|(v[1]<level?2:0)|(v[2]<level?4:0)|(v[3]<level?8:0);
        if(!code||code===15)continue;
        const ids=[i*2,(i+1)*2+1,(i+w)*2,i*2+1],cx=[x,x+1,x+1,x],cy=[y,y,y+1,y+1];
        const vertex=e=>{
          const key=ids[e];if(!vertices.has(key)){
            const next=(e+1)%4,t=(level-v[e])/(v[next]-v[e]);
            vertices.set(key,{x:(cx[e]+(cx[next]-cx[e])*t)*step+offset,y:(cy[e]+(cy[next]-cy[e])*t)*step,links:[]});
          }return key;
        };
        for(const [a,b]of cases[code]){const u=vertex(a),v=vertex(b);vertices.get(u).links.push(v);vertices.get(v).links.push(u);}
      }
      const seen=new Set();
      for(const start of vertices.keys()){
        if(seen.has(start))continue;
        const points=[];let at=start,previous=null;
        while(at!==undefined&&!seen.has(at)){
          seen.add(at);const p=vertices.get(at);points.push(p);
          const next=p.links.find(k=>k!==previous);previous=at;at=next;
        }
        if(points.length<9||at!==start)continue;
        const first=points[0],last=points.at(-1);
        all+=`M${f((last.x+first.x)/2)},${f((last.y+first.y)/2)}`;
        for(let i=0;i<points.length;i++){
          const p=points[i],next=points[(i+1)%points.length];
          all+=`Q${f(p.x)},${f(p.y)} ${f((p.x+next.x)/2)},${f((p.y+next.y)/2)}`;
        }
        all+='Z';
      }
    }
    return all;
  }
  function artFor(value){
    if(!artwork.has(value))artwork.set(value,contours(fieldFor(value),W,H));
    return artwork.get(value);
  }
  function sample(field,x,y){
    const px=clamp(x,0,W-1.001),py=clamp(y,0,H-1.001),ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy,i=iy*W+ix;
    return (field[i]*(1-fx)+field[i+1]*fx)*(1-fy)+(field[i+W]*(1-fx)+field[i+W+1]*fx)*fy+Math.max(0,-x,x-W+1)*.8;
  }
  function liquidPath(from,to,t,seed){
    const step=2,w=140,h=136,offset=-50,field=new Float32Array(w*h);
    // Fast attack, quick reunion, then a small compression on settling.
    const burst=t<.2?1-Math.pow(1-t/.2,3):Math.pow(1-(t-.2)/.8,2);
    const recoil=t>.68?.1*Math.sin((t-.68)/.32*Math.PI):0;
    const envelope=burst-recoil,blend=1-Math.pow(1-clamp((t-.1)/.68,0,1),3),phase=seed*.77;
    for(let y=0;y<h;y++){
      const py=y*step;
      // Opposing horizontal flows open two necks into separated islands, then
      // join them into the next numeral. Motion never rotates a plane.
      const band=Math.sin(py*.065+phase),shift=envelope*(34*band+14*Math.sin(py*.13+phase));
      const stretch=1+envelope*(.65+.95*Math.pow(Math.sin(py*.034+phase),4));
      const tear=Math.max(0,envelope)*24*(Math.exp(-Math.pow((py-94-8*Math.sin(phase))/8,2))+Math.exp(-Math.pow((py-181)/7,2)));
      for(let x=0;x<w;x++){
        const px=x*step+offset,qx=90+(px-90-shift)/stretch;
        const qy=py+envelope*4*Math.sin((px-90)*.045+phase);
        const a=sample(from,qx,qy),b=sample(to,qx,qy);
        field[y*w+x]=a*(1-blend)+b*blend+tear;
      }
    }
    return contours(field,w,h,step,offset);
  }
  class InkClock{
    constructor(rows){
      this.digits=[];this.frame=0;this.lastFrame=0;
      for(const row of rows)for(let i=0;i<2;i++){
        const el=document.createElement('span');el.className='digit';
        const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 180 272');svg.setAttribute('aria-hidden','true');
        const path=document.createElementNS(NS,'path');path.setAttribute('vector-effect','non-scaling-stroke');svg.append(path);el.append(svg);row.append(el);
        this.digits.push({el,path,value:undefined,motion:null});
      }
      this.observer=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;if(this.visible)this.schedule();},{threshold:0});
      this.observer.observe(rows[0].closest('.clock'));this.visible=true;
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.schedule();});
      reduced.addEventListener('change',()=>{if(reduced.matches)this.finish();});
    }
    setTime(value,animate=true){[...value].forEach((n,i)=>this.setDigit(this.digits[i],n,animate,i));}
    setDigit(d,n,animate,index=0,force=false){
      if(d.value===n&&!force)return;
      const old=d.value;d.value=n;d.el.dataset.value=n;
      if(animate&&!reduced.matches&&old!==undefined&&!document.hidden){
        // Snapshots are cached; only changing numerals are recomputed per frame.
        d.motion={from:fieldFor(old),to:fieldFor(n),start:performance.now(),seed:index+Number(n),duration:360};
        d.el.dataset.moving='true';this.schedule();
      }else{d.motion=null;d.path.setAttribute('d',artFor(n));delete d.el.dataset.moving;}
    }
    ripple(){this.digits.forEach((d,i)=>this.setDigit(d,d.value,true,i,true));}
    schedule(){if(!this.frame&&this.visible&&!document.hidden)this.frame=requestAnimationFrame(now=>this.draw(now));}
    draw(now){
      this.frame=0;if(document.hidden||!this.visible)return;
      let active=false;
      if(now-this.lastFrame<16){this.schedule();return;}this.lastFrame=now;
      for(const d of this.digits){
        const m=d.motion;if(!m)continue;
        const t=clamp((now-m.start)/m.duration,0,1);
        if(t===1){d.motion=null;d.path.setAttribute('d',artFor(d.value));delete d.el.dataset.moving;}
        else{d.path.setAttribute('d',liquidPath(m.from,m.to,t,m.seed));active=true;}
      }
      if(active)this.schedule();
    }
    finish(){for(const d of this.digits)if(d.value!==undefined){d.motion=null;d.path.setAttribute('d',artFor(d.value));delete d.el.dataset.moving;}}
    warm(){
      let n=0;const next=()=>{if(n>9)return;fieldFor(String(n++));if('requestIdleCallback'in window)requestIdleCallback(next);else setTimeout(next,90);};next();
    }
  }
  window.InkClock=InkClock;
})();
