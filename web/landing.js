const depthData = {
  0:{temp:"29.1°C",unc:"LOW"},
  50:{temp:"28.8°C",unc:"LOW"},
  100:{temp:"28.4°C",unc:"LOW"},
  200:{temp:"27.1°C",unc:"MEDIUM"},
  500:{temp:"20.6°C",unc:"MEDIUM"},
  1000:{temp:"7.8°C",unc:"HIGH"}
};

document.addEventListener("DOMContentLoaded", () => {
  const depthSlider=document.getElementById("depthSlider");
  const depthValue=document.getElementById("depthValue");
  const depthPoint=document.getElementById("depthPoint");
  const tempValue=document.getElementById("tempValue");
  const layerLabel=document.getElementById("layerLabel");
  const consoleTemp=document.getElementById("consoleTemp");
  const consoleUncertainty=document.getElementById("consoleUncertainty");
  const heatmap=document.getElementById("heatmap");

  function updateDepth(v){
    const d=Math.round(v/50)*50;
    const data=depthData[d] || depthData[100];
    if(depthValue) depthValue.textContent=d+" m";
    if(tempValue) tempValue.textContent=data.temp;
    const pct=Math.min(96, 3 + d/1000*94);
    if(depthPoint) depthPoint.style.top=pct+"%";
    if(layerLabel) layerLabel.textContent=d+" M";
    if(consoleTemp) consoleTemp.textContent=data.temp;
    if(consoleUncertainty) consoleUncertainty.textContent=data.unc;
    document.querySelectorAll(".layer-tabs button").forEach(b=>b.classList.toggle("active", Number(b.dataset.depth)===d));
    const hue = Math.max(0, 185-d*.09);
    if(heatmap) heatmap.style.background=`radial-gradient(circle at ${45+d/35}% ${35+d/80}%, hsl(${hue},75%,70%) 0 3%, hsl(${Math.max(145,hue-15)},45%,48%) 12%, hsl(${Math.max(160,hue-30)},55%,35%) 34%, #0b3c51 62%, #061923 90%)`;
  }

  if (depthSlider) {
    depthSlider.addEventListener("input",e=>updateDepth(e.target.value));
  }
  document.querySelectorAll(".layer-tabs button").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const d=Number(btn.dataset.depth);
      if(depthSlider) depthSlider.value=d;
      updateDepth(d);
    });
  });
  updateDepth(100);

  const observer=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add("visible")});
  },{threshold:.12});
  document.querySelectorAll(".reveal").forEach(el=>observer.observe(el));

  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener("click",e=>{
      const target=document.querySelector(a.getAttribute("href"));
      if(target){e.preventDefault();target.scrollIntoView({behavior:"smooth",block:"start"});}
    });
  });

  if (window.location.hash === '#demo') {
    openSampleDemo();
  }
});

// View Switching Functions
window.handleViewSelect = function(val) {
  if (val === 'view_demo') {
    window.location.href = 'view_demo/index.html';
  } else if (val === 'story') {
    window.openStoryLanding();
  } else if (val === 'deck') {
    window.openSampleDemo();
  }
};

window.openSampleDemo = function() {
  const landing = document.getElementById('landing-view');
  const demo = document.getElementById('demo-view');
  if (landing) landing.style.display = 'none';
  if (demo) demo.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });
  window.location.hash = 'demo';
  
  const viewSelect = document.getElementById('protoViewSelect');
  if (viewSelect) viewSelect.value = 'deck';

  setTimeout(() => {
    if (typeof appState !== 'undefined' && appState.map) {
      appState.map.invalidateSize();
      if (typeof renderCanvasOverlay === 'function') {
        renderCanvasOverlay();
      }
    }
    if (typeof appState !== 'undefined') {
      if (appState.profileChart) appState.profileChart.resize();
      if (appState.soundChart) appState.soundChart.resize();
      if (appState.transectChart) appState.transectChart.resize();
      if (appState.argoProofChart) appState.argoProofChart.resize();
    }
  }, 120);
};

window.openStoryLanding = function() {
  const landing = document.getElementById('landing-view');
  const demo = document.getElementById('demo-view');
  if (demo) demo.style.display = 'none';
  if (landing) landing.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });
  
  const viewSelect = document.getElementById('protoViewSelect');
  if (viewSelect) viewSelect.value = 'story';

  try {
    history.replaceState(null, null, window.location.pathname);
  } catch (e) {
    window.location.hash = '';
  }
};
