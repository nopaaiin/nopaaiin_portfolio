import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const viewers=[];
const observer=new ResizeObserver(entries=>{for(const {target} of entries){const v=viewers.find(v=>v.el===target);if(!v)continue;const w=target.clientWidth,h=target.clientHeight;v.renderer.setSize(w,h,false);v.camera.aspect=w/h;v.camera.updateProjectionMatrix();}});
new GLTFLoader().load('./assets/minecraft_zombie.glb',gltf=>{
 for(const el of document.querySelectorAll('[data-zombie]')){
  const renderer=new THREE.WebGLRenderer({canvas:el.querySelector('canvas'),antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x999999,2.5));
  const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(3,5,4);scene.add(light);
  const model=gltf.scene.clone(true);
  model.traverse(o=>{if(!o.isMesh)return;for(const m of [o.material].flat()){if(m.map){m.map.magFilter=THREE.NearestFilter;m.map.minFilter=THREE.NearestFilter;m.map.generateMipmaps=false;}m.alphaTest=Math.max(m.alphaTest||0,.5);}});
  const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  model.position.sub(center);const pivot=new THREE.Group();pivot.add(model);scene.add(pivot);
  const camera=new THREE.PerspectiveCamera(32,1,.01,1000);const distance=Math.max(size.y,size.x)*2.15;camera.position.set(0,size.y*.04,distance);camera.lookAt(0,0,0);
  viewers.push({el,renderer,scene,camera,pivot});observer.observe(el);
 }
},undefined,error=>console.error('Zombie preview could not load',error));
let previous=performance.now();
function frame(now){const dt=Math.min((now-previous)/1000,.05);previous=now;for(const v of viewers){v.pivot.rotation.y+=dt*.25;v.renderer.render(v.scene,v.camera);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
addEventListener('pagehide',()=>{observer.disconnect();for(const v of viewers)v.renderer.dispose();},{once:true});
