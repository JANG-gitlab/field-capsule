const ze=24,Be=6,Ge=8,De=38,je=52,qe=1976,Ye=8,be=Math.PI/6,G=1/Math.tan(be/2),J=2.3,Ne=20,Ce=Ne*.6,ye=84,Me=44,Pe=`#version 300 es
in vec3 position;
in vec3 normale;
in vec3 bord;
in vec2 couche;
in vec2 uv;
uniform mat4 projection;
uniform float epaisseur;
out vec3 vNormale;
out vec2 vUv;
out vec2 vCouche;
void main() {
  // couche.x : 1 pour la face du molleton, 0 pour celle de la doublure ; couche.y : 1 sur la tranche
  vec3 n = normalize(normale);
  vec3 p = position + n * (couche.x - 0.5) * epaisseur;
  vNormale = couche.y > 0.5 ? bord : n * (couche.x * 2.0 - 1.0);
  vUv = uv;
  vCouche = couche;
  gl_Position = projection * vec4(p.xy, p.z - ${G.toFixed(6)}, 1.0);
}`,ge=`#version 300 es
precision highp float;
in vec3 vNormale;
in vec2 vUv;
in vec2 vCouche;
uniform vec2 taille;
uniform float bordRevers;
out vec4 couleur;

const vec3 BLEU = vec3(0.0, 0.443, 0.733);
const vec3 BLANC = vec3(0.957, 0.957, 0.949);

float hasard(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bruit(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hasard(i), hasard(i + vec2(1, 0)), f.x), mix(hasard(i + vec2(0, 1)), hasard(i + 1.0), f.x), f.y);
}
vec3 coeur(vec2 px, float t) {
  return vec3(0.91, 0.89, 0.84) + (bruit(vec2(px.y * 0.9, t * 9.0)) - 0.5) * 0.1;
}
vec3 molleton(vec2 px) {
  float chine = bruit(px * vec2(0.5, 0.16)) * 0.6 + bruit(px * vec2(1.3, 0.4)) * 0.4;
  return vec3(0.6, 0.6, 0.59) + (chine - 0.5) * 0.14;
}

void main() {
  vec3 n = normalize(vNormale);
  // la cam\xE9ra est presque de face : on \xE9claire toujours le c\xF4t\xE9 qui nous regarde
  if (n.z < 0.0) n = -n;
  float lumiere = 0.42 + 0.62 * max(dot(n, normalize(vec3(-0.35, 0.55, 1.0))), 0.0);
  vec2 px = vUv * taille;
  vec3 c;
  if (vCouche.y > 0.5) {
    // la tranche : la doublure, le molleton gratt\xE9 \xE9cru au c\u0153ur, puis le jersey gris de l'endroit
    float t = vCouche.x;
    c = t < 0.14 ? BLEU : t > 0.86 ? molleton(px) : coeur(px, t);
    lumiere *= 0.92;
  } else if (vCouche.x > 0.5) {
    c = molleton(px);
    // le revers rabattu porte son ombre sur le molleton, juste avant son bord
    float avant = bordRevers - px.x;
    c *= 1.0 - 0.5 * step(0.0, avant) * exp(-avant / 10.0);
  } else {
    vec2 q = px / ${Me.toFixed(1)};
    float d = length(fract(q) - 0.5);
    float b = fwidth(d) * 1.2;
    c = mix(BLEU, BLANC, 1.0 - smoothstep(0.17 - b, 0.17 + b, d));
    // au bord coup\xE9 du revers, on devine la tranche : le molleton \xE9cru, plus sombre vers le bas de l'\xE9paisseur
    float coupe = (1.0 - vUv.x) * taille.x;
    if (coupe < 6.0) c = coeur(px, coupe / 6.0) * mix(0.7, 1.0, coupe / 6.0);
  }
  couleur = vec4(c * lumiere, 1.0);
}`,me=(l,s,d)=>{const t=l.createShader(s);if(l.shaderSource(t,d),l.compileShader(t),!l.getShaderParameter(t,l.COMPILE_STATUS))throw new Error(l.getShaderInfoLog(t));return t},Fe=l=>{const s=G,d=.1,t=20;return new Float32Array([s/l,0,0,0,0,s,0,0,0,0,(t+d)/(d-t),-1,0,0,2*t*d/(d-t),0])},Te=(l,s,d)=>Float32Array.from({length:38},(t,m)=>m<24?l*m/23:m<30?l+Math.PI*s*(m-24+1)/6:l+Math.PI*s+d*(m-24-6+1)/8),Ae=(l,s,d)=>{const t=r=>r.subarray(s*3,(s+1976)*3),m={cote:l,debut:s,pos:t(d.pos),prec:t(d.prec),repos:t(d.repos),normales:t(d.normales)},h=[],n=(r,a)=>a*38+r;for(let r=0;r<52;r++)for(let a=0;a<38;a++)a+1<38&&h.push(n(a,r),n(a+1,r)),r+1<52&&h.push(n(a,r),n(a,r+1)),a+1<38&&r+1<52&&h.push(n(a,r),n(a+1,r+1),n(a+1,r),n(a,r+1)),a+2<38&&h.push(n(a,r),n(a+2,r)),r+2<52&&h.push(n(a,r),n(a,r+2)),a+3<38&&h.push(n(a,r),n(a+3,r));return m.liens=new Uint16Array(h),m.longueurs=new Float32Array(h.length/2),m},Ie=(l,s,d,t)=>{const m=l.cote*(s+.03);for(let n=0;n<52;n++)for(let r=0;r<38;r++){const a=(n*38+r)*3,E=l.abscisses[r];let A=E,v=0;if(E>d){const O=Math.min(Math.PI,(E-d)/t);A=d+t*Math.sin(O)-Math.max(0,E-d-Math.PI*t),v=t*(1-Math.cos(O))}l.repos[a]=m-l.cote*A,l.repos[a+1]=J/2-n/51*J,l.repos[a+2]=v}l.pos.set(l.repos),l.prec.set(l.repos);const h=l.repos;for(let n=0;n<l.longueurs.length;n++){const r=l.liens[n*2]*3,a=l.liens[n*2+1]*3;l.longueurs[n]=Math.hypot(h[r]-h[a],h[r+1]-h[a+1],h[r+2]-h[a+2])}},we=l=>{const{pos:s,prec:d,repos:t}=l;for(let m=0;m<52;m++)for(let h=1;h<38;h++){const n=(m*38+h)*3,a=.006*(1-.4*(h/37));for(let E=0;E<3;E++){const A=(s[n+E]-d[n+E])*.93;d[n+E]=s[n+E],s[n+E]+=A+(t[n+E]-s[n+E])*a+(E===1?-15e-5:0)}}},_e=l=>{const{pos:s,repos:d,liens:t,longueurs:m,abscisses:h}=l;for(let n=0;n<m.length;n++){const r=t[n*2]*3,a=t[n*2+1]*3,E=s[a]-s[r],A=s[a+1]-s[r+1],v=s[a+2]-s[r+2],O=Math.sqrt(E*E+A*A+v*v)||1e-6,R=(O-m[n])/O*.5;s[r]+=E*R,s[r+1]+=A*R,s[r+2]+=v*R,s[a]-=E*R,s[a+1]-=A*R,s[a+2]-=v*R}for(let n=0;n<52;n++){const r=n*38*3;s[r]=d[r],s[r+1]=d[r+1],s[r+2]=d[r+2];for(let a=1;a<38;a++){const E=r+a*3,A=s[E]-s[r],v=s[E+1]-s[r+1],O=s[E+2]-s[r+2],R=A*A+v*v+O*O,P=h[a];if(R>P*P){const g=P/Math.sqrt(R);s[E]=s[r]+A*g,s[E+1]=s[r+1]+v*g,s[E+2]=s[r+2]+O*g}}}},Ue=l=>{const{pos:s,normales:d,cote:t}=l,m=(h,n)=>(Math.min(51,Math.max(0,n))*38+Math.min(37,Math.max(0,h)))*3;for(let h=0;h<52;h++)for(let n=0;n<38;n++){const r=m(n+1,h),a=m(n-1,h),E=m(n,h-1),A=m(n,h+1),v=s[r]-s[a],O=s[r+1]-s[a+1],R=s[r+2]-s[a+2],P=s[E]-s[A],g=s[E+1]-s[A+1],I=s[E+2]-s[A+2],w=(O*I-R*g)*-t,D=(R*P-v*I)*-t,_=(v*g-O*P)*-t,W=Math.hypot(w,D,_)||1,X=(h*38+n)*3;d[X]=w/W,d[X+1]=D/W,d[X+2]=_/W}},ke=(l,{reserve:s,demo:d=!0}={})=>{const t=l.getContext("webgl2",{antialias:!0,premultipliedAlpha:!0});if(!t)throw new Error("webgl2-absent");const m=matchMedia("(prefers-reduced-motion: reduce)").matches,h=t.createProgram();t.attachShader(h,me(t,t.VERTEX_SHADER,Pe)),t.attachShader(h,me(t,t.FRAGMENT_SHADER,ge)),t.linkProgram(h),t.useProgram(h);const n=1976*2,r={pos:new Float32Array(n*3),prec:new Float32Array(n*3),repos:new Float32Array(n*3),normales:new Float32Array(n*3)},a=[Ae(-1,0,r),Ae(1,1976,r)],E=[],A=[],v=[],O=[],R=(e,c,u,i)=>{E.push(e),A.push(c),v.push(u,i)};a.forEach(({debut:e})=>{const c=(i,o)=>e+o*38+i;for(const i of[1,0]){const o=E.length;for(let f=0;f<52;f++)for(let p=0;p<38;p++)R(c(p,f),-1,i,0);for(let f=0;f+1<52;f++)for(let p=0;p+1<38;p++){const N=o+f*38+p,S=N+38;O.push(N,S,N+1,N+1,S,S+1)}}const u=i=>{const o=E.length;i.forEach(([f,p])=>{R(f,p,1,1),R(f,p,0,1)});for(let f=0;f+1<i.length;f++){const p=o+f*2;O.push(p,p+1,p+2,p+2,p+1,p+3)}};u(Array.from({length:52},(i,o)=>[c(37,o),c(36,o)])),u(Array.from({length:38},(i,o)=>[c(o,0),c(o,1)])),u(Array.from({length:38},(i,o)=>[c(o,51),c(o,50)]))});const P=E.length,g=new Float32Array(P*3),I=new Float32Array(P*3),w=new Float32Array(P*3),D=new Float32Array(P*2),_=(e,c,u,i)=>{const o=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,o),t.bufferData(t.ARRAY_BUFFER,e,i);const f=t.getAttribLocation(h,c);return t.enableVertexAttribArray(f),t.vertexAttribPointer(f,u,t.FLOAT,!1,0,0),o};t.bindVertexArray(t.createVertexArray());const W=_(g,"position",3,t.DYNAMIC_DRAW),X=_(I,"normale",3,t.DYNAMIC_DRAW),Se=_(w,"bord",3,t.DYNAMIC_DRAW),ve=_(D,"uv",2,t.DYNAMIC_DRAW);_(new Float32Array(v),"couche",2,t.STATIC_DRAW),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ELEMENT_ARRAY_BUFFER,new Uint16Array(O),t.STATIC_DRAW),t.enable(t.DEPTH_TEST);const K=Object.fromEntries(["projection","taille","bordRevers","epaisseur"].map(e=>[e,t.getUniformLocation(h,e)])),U=new Float32Array(n*2);let j=.03,z=1,ce=1;const te=()=>{const e=l.clientWidth,c=l.clientHeight;if(!e||!c)return;const u=Math.min(devicePixelRatio||1,2);l.width=Math.round(e*u),l.height=Math.round(c*u),t.viewport(0,0,l.width,l.height),z=e/c,ce=c;const i=s?(e-s.getBoundingClientRect().width)/2-28:e*.25,o=Math.min(.3,Math.max(.08,i/e))*2*z,f=c/2,p=Ce/f,N=o-p,S=Math.min(ye/f,N*.4),C=Te(N,p,S),F=C[37];j=Ne/f,a.forEach(L=>{L.abscisses=C,Ie(L,z,N,p)});for(let L=0;L<n;L++){const M=L%1976,x=M%38,B=(M-x)/38;U[L*2]=C[x],U[L*2+1]=B/51*J}E.forEach((L,M)=>{D[M*2]=U[L*2]/F,D[M*2+1]=U[L*2+1]/J}),t.bindBuffer(t.ARRAY_BUFFER,ve),t.bufferSubData(t.ARRAY_BUFFER,0,D),t.uniformMatrix4fv(K.projection,!1,Fe(z)),t.uniform2f(K.taille,F*f,J*f),t.uniform1f(K.bordRevers,(N-S)*f),t.uniform1f(K.epaisseur,j)},oe=16384,q=new Int32Array(oe+1),ie=new Int32Array(n),ne=(e,c,u)=>(Math.imul(e,92837111)^Math.imul(c,689287499)^Math.imul(u,283923481))&oe-1,Oe=()=>{const{pos:e}=r,c=o=>Math.floor(o/j);q.fill(0);for(let o=0;o<n;o++)q[ne(c(e[o*3]),c(e[o*3+1]),c(e[o*3+2]))]++;for(let o=1;o<=oe;o++)q[o]+=q[o-1];for(let o=0;o<n;o++)ie[--q[ne(c(e[o*3]),c(e[o*3+1]),c(e[o*3+2]))]]=o;const u=(j*1.5)**2,i=j*j;for(let o=0;o<n;o++){if(o%38===0)continue;const f=c(e[o*3]),p=c(e[o*3+1]),N=c(e[o*3+2]);for(let S=f-1;S<=f+1;S++)for(let C=p-1;C<=p+1;C++)for(let F=N-1;F<=N+1;F++){const L=ne(S,C,F);for(let M=q[L];M<q[L+1];M++){const x=ie[M];if(x<=o||x%38===0)continue;const B=e[x*3]-e[o*3],k=e[x*3+1]-e[o*3+1],T=e[x*3+2]-e[o*3+2],Y=B*B+k*k+T*T;if(Y>=i||Y<1e-18)continue;const V=U[o*2]-U[x*2],pe=U[o*2+1]-U[x*2+1];if(o<1976==x<1976&&V*V+pe*pe<u)continue;const de=Math.sqrt(Y),H=(j-de)/de*.5;e[o*3]-=B*H,e[o*3+1]-=k*H,e[o*3+2]-=T*H,e[x*3]+=B*H,e[x*3+1]+=k*H,e[x*3+2]+=T*H}}}},y={x:0,y:0,dedans:!1};let b=null;const re=(e,c)=>{const u=G-e[c+2];return[G*e[c]/(u*z),G*e[c+1]/u]},ae=e=>{const c=l.getBoundingClientRect();y.x=(e.clientX-c.left)/c.width*2-1,y.y=1-(e.clientY-c.top)/c.height*2},le=({repos:e},c)=>{const u=[];for(let i=0;i<e.length;i+=3){if(i%114===0)continue;const o=1-Math.hypot(e[i]-e[c],e[i+1]-e[c+1])/.24;o>0&&u.push(i,o)}return u},Re=()=>{let e=null,c=48/ce*2;return a.forEach(u=>{for(let i=0;i<u.pos.length;i+=3){if(i%114===0)continue;const[o,f]=re(u.pos,i),p=Math.hypot((o-y.x)*z,f-y.y);p<c&&(c=p,e={pan:u,k:i})}}),e&&(e.z=e.pan.pos[e.k+2]+.12,e.zone=le(e.pan,e.k)),e},ue=()=>{const{pan:{pos:e,abscisses:c},k:u,z:i}=b,o=G-i;let f=y.x*z*o/G,p=y.y*o/G;const N=u-u%114,S=c[(u-N)/3],C=f-e[N],F=p-e[N+1],L=i-e[N+2],M=Math.hypot(C,F,L);M>S&&(f=e[N]+C*S/M,p=e[N+1]+F*S/M);const x=f-e[u],B=p-e[u+1],k=i-e[u+2];for(let T=0;T<b.zone.length;T+=2){const Y=b.zone[T],V=b.zone[T+1];e[Y]+=x*V,e[Y+1]+=B*V,e[Y+2]+=k*V}},Le=()=>{a.forEach(e=>{for(let c=0;c<e.pos.length;c+=3){const[u,i]=re(e.pos,c),o=Math.hypot((u-y.x)*z,i-y.y);o<.22&&(e.pos[c+2]+=(1-o/.22)*.0018)}})};l.addEventListener("pointerdown",e=>{ae(e),b=Re(),b&&l.setPointerCapture(e.pointerId),se()}),l.addEventListener("pointermove",e=>{ae(e),y.dedans=!0,se()}),l.addEventListener("pointerleave",()=>{y.dedans=!1});const fe=()=>{b=null};l.addEventListener("pointerup",fe),l.addEventListener("pointercancel",fe);let $=!1,Q=0,Z=0,he=!d||m;const xe=()=>{he=!0;const e=a[1],c=(Math.round(52*.55)*38+24+6/2)*3,[u,i]=re(e.pos,c),o=performance.now(),f=p=>{const N=Math.min(1,(p-o)/1100),S=N<.5?2*N*N:1-(-2*N+2)**2/2;b&&b.demo===void 0||(y.x=u+(.92-u)*S,y.y=i+.12*Math.sin(N*Math.PI),b={pan:e,k:c,zone:le(e,c),z:.2*Math.sin(N*Math.PI)+.04,demo:!0},N<1?requestAnimationFrame(f):b=null)};requestAnimationFrame(f)},ee=()=>{a.forEach(Ue);const{pos:e,normales:c}=r;for(let u=0;u<P;u++){const i=E[u]*3,o=u*3;if(g[o]=e[i],g[o+1]=e[i+1],g[o+2]=e[i+2],I[o]=c[i],I[o+1]=c[i+1],I[o+2]=c[i+2],A[u]>=0){const f=A[u]*3,p=e[i]-e[f],N=e[i+1]-e[f+1],S=e[i+2]-e[f+2],C=Math.hypot(p,N,S)||1;w[o]=p/C,w[o+1]=N/C,w[o+2]=S/C}}for(const[u,i]of[[W,g],[X,I],[Se,w]])t.bindBuffer(t.ARRAY_BUFFER,u),t.bufferSubData(t.ARRAY_BUFFER,0,i);t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT|t.DEPTH_BUFFER_BIT),t.drawElements(t.TRIANGLES,O.length,t.UNSIGNED_SHORT,0)},Ee=()=>{if(Q=0,!$)return;a.forEach(we),b?ue():y.dedans&&Le();for(let i=0;i<8;i++)a.forEach(_e),b&&ue(),i===8/2&&Oe();let e=0;const{pos:c,prec:u}=r;for(let i=0;i<c.length;i++)e=Math.max(e,Math.abs(c[i]-u[i]));ee(),Z=e<1e-5&&!b?Z+1:0,Z<30&&(Q=requestAnimationFrame(Ee))},se=()=>{Z=0,$&&!Q&&(Q=requestAnimationFrame(Ee))};new ResizeObserver(()=>{te(),ee()}).observe(l),new IntersectionObserver(([e])=>{$=e.isIntersecting,$&&se(),$&&e.intersectionRatio>.5&&!he&&setTimeout(xe,500)},{threshold:[0,.55]}).observe(l),document.fonts?.ready.then(()=>{te(),ee()}),te(),ee()};export{ke as monterTissu};
