/*! shore-scroll.js — the hero photo itself retreats up the screen like a wave sliding off wet sand (WebGL).
 * Place the canvas over the hero <img>; once the photo loads the canvas takes over drawing it, so there is no seam.
 * data-*: image (same src as the hero img), replace (selector of the img to hide once ready), trigger, range ("start,end" of
 *   trigger scroll, 0–1), bg (ground revealed, hex), foam (0–2), speed, idle (true|false).
 */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FS = [
    'precision highp float;',
    'uniform vec2 R,IS;uniform float T,P,FO,HAS,E;uniform vec3 BG;uniform sampler2D IMG;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}',
    'float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;float sa=R.x/R.y,t=T;',
    ' float pr=1.-(1.-P)*(1.-P);',
    ' float slide=pr*1.8;',                                             // photo + water travel up together
    ' vec2 a=vec2(uv.x*sa,uv.y+slide);',                                // coords anchored to the photo
    ' float shape=(fbm(vec2(a.x*1.1,0.))-.5)*.3+(fbm(vec2(a.x*3.4,5.))-.5)*.08+(.01+.035*E)*sin(a.x*3.+t*.5)+.03*E*sin(a.x*1.3-t*1.7);',
    ' float d=a.y-(1.2+shape);',                                        // >0 = water has left
    ' float fd=d+(fbm(a*vec2(5.,9.))-.5)*.05;',
    ' float near=1.-smoothstep(0.,.3,-d);',
    ' vec2 wob=vec2(fbm(a*5.+t*.12)-.5,fbm(a*5.+3.-t*.1)-.5)*(.014+.03*E)*near;',
    ' vec2 su=vec2(uv.x,uv.y+slide)+wob;float ia=IS.x/IS.y;vec2 iu=su;',
    ' if(sa>ia){iu.y=.5+(su.y-.5)*ia/sa;}else{iu.x=.5+(su.x-.5)*sa/ia;}',
    ' vec3 c0=texture2D(IMG,clamp(iu,vec2(0.,0.),vec2(1.,.998))).rgb;',
    ' float xl=.02+abs(fract(uv.x*.9+.13)*2.-1.)*.34;',                    // clear water from the photo's left side — never the subject
    ' vec3 c1=texture2D(IMG,vec2(xl,clamp(.97-fract((iu.y-.9)*1.1)*.22,0.,.998))).rgb;',
    ' vec3 col=mix(c0,c1,smoothstep(.9,.995,iu.y));',
    ' vec3 shallow=vec3(.36,.8,.82);',
    ' col=mix(col,mix(col,shallow,.5),smoothstep(.2,0.,-d)*.85);',      // thinning sheet of water lightens
    // foam: soft, clumped whitewater streaks running along the shoreline
    ' vec2 fw=a*vec2(2.,6.5)+vec2(fbm(a*vec2(1.3,3.5)+t*.02)*1.8,0.);',
    ' float fn=fbm(fw+vec2(t*.015,0.)),fn2=fbm(a*vec2(7.,16.)+vec2(-t*.02,0.));',
    ' float front=smoothstep(-.12,-.02,fd)*(1.-smoothstep(-.008,.004,fd));',
    ' float trail=smoothstep(-.4,-.03,fd)*(1.-smoothstep(-.03,0.,fd));',
    ' float F=front*smoothstep(.3,.62,fn2*.55+fn*.55)+trail*smoothstep(.56,.74,fn+trail*.12)*.8;',
    ' F=clamp(F*FO*(1.15+E*.9),0.,1.)*smoothstep(0.,.12,P);',
    ' col*=1.-.18*smoothstep(.4,.7,fn)*trail;',
    ' col=mix(col,vec3(.94,.97,.97)*(.88+.12*fn2),F);',
    ' float waterA=1.-smoothstep(-.004,.006,fd);',
    ' float film=(1.-smoothstep(0.,.05,d))*.5*smoothstep(0.,.1,P);',
    ' float sheen=exp(-max(d,0.)*5.)*.2*pr;',
    ' vec3 g=mix(BG,shallow*.5,film)+vec3(.5,.7,.75)*sheen*.3;',
    ' float gA=clamp(film+sheen,0.,1.);',
    ' float a0=max(waterA,gA)*HAS;',
    ' vec4 photo=vec4(mix(g,col,waterA)*a0,a0);',                         // premultiplied: renders the same in every browser
    // wet-sand band: a second, lighter tide line trailing the retreating water (a faint veil, so text behind stays readable)
    ' float sand=(1.-smoothstep(.9,.93,d))*smoothstep(0.,.15,P)*HAS;',
    ' vec4 band=vec4(BG*1.2,.2)*sand;',
    ' gl_FragColor=photo+band*(1.-photo.a);',
    '}'].join('\n');

  function hexRgb(c) { var m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec((c || '').trim()); return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [.086, .094, .149]; }
  function read(el) {
    var d = el.dataset;
    return { image: d.image || '', replace: d.replace || '', range: (d.range || '0,1').split(',').map(Number),
      bg: hexRgb(d.bg || '#161826'), foam: +(d.foam == null ? 1 : d.foam), speed: +(d.speed || 1), idle: d.idle !== 'false' && !reduce,
      trigger: (d.trigger && document.querySelector(d.trigger)) || el.parentElement };
  }
  function sh(gl, type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; }
  function progress(o) {
    var r = o.trigger.getBoundingClientRect(), span = Math.max(1, r.height - innerHeight);
    var raw = Math.min(1, Math.max(0, -r.top / span)), a = o.range[0], b = o.range[1];
    return Math.min(1, Math.max(0, (raw - a) / Math.max(0.001, b - a)));
  }
  function loadImage(st) {
    if (!st.o.image) return;
    var img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = function () {
      var gl = st.gl; gl.bindTexture(gl.TEXTURE_2D, st.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      st.size = [img.naturalWidth, img.naturalHeight]; st.has = 1; st.hideNext = true;
    };
    img.src = st.o.image;
  }
  function init(el) {
    if (el.__shore) return refresh(el);
    var gl = el.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE); });
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    var U = {}; ['R', 'IS', 'T', 'P', 'FO', 'HAS', 'BG', 'IMG', 'E'].forEach(function (k) { U[k] = gl.getUniformLocation(pr, k); });
    var st = { el: el, gl: gl, U: U, tex: tex, o: read(el), p: 0, clock: 0, prev: 0, visible: true, has: 0, size: [1, 1] };
    st.p = progress(st.o);
    el.__shore = st;
    loadImage(st);
    if ('IntersectionObserver' in window) { st.io = new IntersectionObserver(function (e) { st.visible = e[0].isIntersecting; if (st.visible) loop(); }); st.io.observe(el); }
    function loop() {
      if (st.raf || st.dead) return;
      st.raf = requestAnimationFrame(function tick(now) {
        st.raf = 0; if (st.dead || !st.visible) return;
        draw(st, now); st.raf = requestAnimationFrame(tick);
      });
    }
    st.loop = loop; loop();
    return st;
  }
  function draw(st, now) {
    var el = st.el, gl = st.gl, U = st.U, o = st.o;
    var dpr = Math.min(1, window.devicePixelRatio || 1) * 0.75, w = Math.round(el.clientWidth * dpr), h = Math.round(el.clientHeight * dpr);
    if (!w || !h) return;
    var resized = el.width !== w || el.height !== h;
    if (resized) { el.width = w; el.height = h; gl.viewport(0, 0, w, h); }
    var tg = progress(o); st.energy = Math.min(1, (st.energy || 0) * 0.95 + Math.abs(tg - (st.last == null ? tg : st.last)) * 14); st.last = tg;
    st.p += (tg - st.p) * 0.08;
    // only render while the retreat is actually on screen and changing
    var idleFrame = st.has && !resized && !st.hideNext && st.drawn &&
      ((st.p < 0.002 && tg === 0) || (st.p > 0.998 && tg === 1)) && st.energy < 0.01;
    if (idleFrame) { st.prev = now; return; }
    st.drawn = true;
    var dt = st.prev ? Math.min(0.05, (now - st.prev) / 1000) : 0; st.prev = now;
    st.clock += dt * ((o.idle ? 1 : 0) + st.energy * 4) * o.speed;
    gl.uniform2f(U.R, w, h); gl.uniform2f(U.IS, st.size[0], st.size[1]);
    gl.uniform1f(U.T, st.clock + 20); gl.uniform1f(U.P, st.p); gl.uniform1f(U.FO, o.foam);
    gl.uniform1f(U.HAS, st.has); gl.uniform1f(U.E, st.energy); gl.uniform3fv(U.BG, o.bg); gl.uniform1i(U.IMG, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (st.hideNext) { st.hideNext = false; var r = o.replace && document.querySelector(o.replace); if (r) r.style.visibility = 'hidden'; }
  }
  function refresh(el) { var st = el.__shore; if (!st) return init(el); var prev = st.o.image; st.o = read(el); if (st.o.image !== prev) loadImage(st); st.loop(); return st; }
  function destroy(el) { var st = el.__shore; if (!st) return; st.dead = true; cancelAnimationFrame(st.raf); st.io && st.io.disconnect(); delete el.__shore; }
  function initAll() { document.querySelectorAll('[data-shore-scroll]').forEach(init); }
  window.ShoreScroll = { init: init, refresh: refresh, destroy: destroy, initAll: initAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll); else initAll();
})();
