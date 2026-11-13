const O=11,W=.32,H=1.22,I=.12199999999999997,C=`#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}`,F=`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D avant;
uniform sampler2D apres;
// object-fit: cover, calcul\xE9 c\xF4t\xE9 JS : \xE9chelle en xy, d\xE9calage en zw
uniform vec4 cadreAvant;
uniform vec4 cadreApres;
uniform float balayage;
uniform float cellule;
uniform vec2 taille;
uniform vec2 regard;
uniform float souffle;
out vec4 couleur;

const vec3 BLEU = vec3(0.0, 0.443, 0.733);
const vec3 BLANC = vec3(0.957, 0.957, 0.949);
const vec3 ORANGE = vec3(1.0, 0.314, 0.0);
const float BANDE = ${.32.toFixed(3)};

vec3 lire(sampler2D image, vec4 cadre, vec2 uv) {
  uv = (uv - 0.5) * (1.0 - souffle) + 0.5 + regard;
  return texture(image, uv * cadre.xy + cadre.zw).rgb;
}

void main() {
  float trait = mix(-0.01, 1.0 + BANDE, balayage);
  // 0 sur le trait, 1 en haut de la bande ; n\xE9gatif sous le trait
  float r = (trait - vUv.y) / BANDE;
  vec3 c;
  if (r < 0.0) {
    // la lampe du scanner \xE9claire l'image juste avant le passage
    c = lire(avant, cadreAvant, vUv) + 0.16 * exp(r * BANDE * 70.0);
  } else if (r >= 1.0) {
    c = lire(apres, cadreApres, vUv);
  } else {
    vec2 px = vUv * taille;
    vec2 centre = (floor(px / cellule) + 0.5) * cellule / taille;
    float d = length(fract(px / cellule) - 0.5);
    vec3 echantillon = lire(apres, cadreApres, centre);
    float rayon = mix(0.17, 0.44, smoothstep(0.08, 0.7, r));
    float point = 1.0 - smoothstep(rayon - 1.0 / cellule, rayon + 1.0 / cellule, d);
    vec3 photo = lire(apres, cadreApres, vUv);
    vec3 fond = mix(BLEU, photo, smoothstep(0.22, 0.8, r));
    vec3 encre = mix(BLANC, echantillon, smoothstep(0.1, 0.55, r));
    c = mix(fond, encre, point * (1.0 - smoothstep(0.7, 1.0, r)));
  }
  float epaisseur = 1.5 / taille.y;
  c = mix(c, ORANGE, 1.0 - smoothstep(epaisseur * 0.5, epaisseur, abs(vUv.y - trait)));
  couleur = vec4(c, 1.0);
}`,N=(r,o,f)=>{const a=r.createShader(o);if(r.shaderSource(a,f),r.compileShader(a),!r.getShaderParameter(a,r.COMPILE_STATUS))throw new Error(r.getShaderInfoLog(a));return a},S=r=>new Promise((o,f)=>{const a=new Image;a.decoding="async",a.onload=()=>o(a),a.onerror=f,a.src=r});async function j(r,o,f,{reduit:a=!1}={}){const e=r.getContext("webgl2",{antialias:!1,alpha:!1}),s=e.createProgram();e.attachShader(s,N(e,e.VERTEX_SHADER,C)),e.attachShader(s,N(e,e.FRAGMENT_SHADER,F)),e.linkProgram(s),e.useProgram(s);const P=t=>e.getUniformLocation(s,t),i=Object.fromEntries(["avant","apres","cadreAvant","cadreApres","balayage","cellule","taille","regard","souffle"].map(t=>[t,P(t)]));e.uniform1i(i.avant,0),e.uniform1i(i.apres,1),e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW);const y=e.getAttribLocation(s,"position");e.enableVertexAttribArray(y),e.vertexAttribPointer(y,2,e.FLOAT,!1,0,0);const D=t=>{const n=e.createTexture();return e.bindTexture(e.TEXTURE_2D,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGB,e.RGB,e.UNSIGNED_BYTE,t),n},b=await S(o.poster),X=await Promise.all(f.map(S)),d=[{image:b,texture:D(b),video:!0},...X.map(t=>({image:t,texture:D(t)}))];let v=0,m=0;const _=t=>{const E=t.video&&o.readyState>=2?o.videoWidth/o.videoHeight:t.image.naturalWidth/t.image.naturalHeight,c=v/m;let u=1,U=1;E>c?u=c/E:U=E/c;const h=c>=1,w=t.video&&h?.3:.5,M=t.video&&!h?.3:.5,x=!t.video&&h?1.22:1,G=!t.video&&h?I:0;return[u*x,U*x,((1-u)*w-.5)*x+.5+G,((1-U)*M-.5)*x+.5]};let A=-1,R={x:0,y:0},l={x:0,y:0},p=0,g=!1;const L=()=>{const t=Math.min(devicePixelRatio,1.5);v=Math.round(r.clientWidth*t),m=Math.round(r.clientHeight*t),r.width=v,r.height=m,e.viewport(0,0,v,m),e.uniform1f(i.cellule,11*t),e.uniform2f(i.taille,v,m)},B=t=>{p=0;const n=Math.min(d.length-2,Math.floor(A+1)),E=Math.min(1,A+1-n),c=d[n],u=d[n+1];c.video&&o.readyState>=2&&(e.bindTexture(e.TEXTURE_2D,c.texture),e.texImage2D(e.TEXTURE_2D,0,e.RGB,e.RGB,e.UNSIGNED_BYTE,o)),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,c.texture),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,u.texture),e.activeTexture(e.TEXTURE0),e.uniform4f(i.cadreAvant,..._(c)),e.uniform4f(i.cadreApres,..._(u)),e.uniform1f(i.balayage,E),l.x+=(R.x-l.x)*.06,l.y+=(R.y-l.y)*.06,e.uniform2f(i.regard,l.x*.012,l.y*.008),e.uniform1f(i.souffle,a?0:.012*(.5+.5*Math.sin(t/1400))),e.drawArrays(e.TRIANGLES,0,3),g&&!a&&(p=requestAnimationFrame(B))},T=()=>{p||(p=requestAnimationFrame(B))};return L(),new ResizeObserver(()=>{L(),T()}).observe(r),new IntersectionObserver(([t])=>{g=t.isIntersecting,g&&T()}).observe(r),{placer(t){A=Math.max(-1,Math.min(d.length-2,t)),T()},regarder(t,n){R={x:t,y:n},T()}}}export{j as monterReleve};
