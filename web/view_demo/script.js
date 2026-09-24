const depthData = {
  0:{temp:"29.1°C",unc:"LOW"},
  50:{temp:"28.8°C",unc:"LOW"},
  100:{temp:"28.4°C",unc:"LOW"},
  200:{temp:"27.1°C",unc:"MEDIUM"},
  500:{temp:"20.6°C",unc:"MEDIUM"},
  1000:{temp:"7.8°C",unc:"HIGH"}
};

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
  depthValue.textContent=d+" m";
  tempValue.textContent=data.temp;
  const pct=Math.min(96, 3 + d/1000*94);
  depthPoint.style.top=pct+"%";
  layerLabel.textContent=d+" M";
  consoleTemp.textContent=data.temp;
  consoleUncertainty.textContent=data.unc;
  document.querySelectorAll(".layer-tabs button").forEach(b=>b.classList.toggle("active", Number(b.dataset.depth)===d));
  const hue = Math.max(0, 185-d*.09);
  heatmap.style.background=`radial-gradient(circle at ${45+d/35}% ${35+d/80}%, hsl(${hue},75%,70%) 0 3%, hsl(${Math.max(145,hue-15)},45%,48%) 12%, hsl(${Math.max(160,hue-30)},55%,35%) 34%, #0b3c51 62%, #061923 90%)`;
}
depthSlider.addEventListener("input",e=>updateDepth(e.target.value));
document.querySelectorAll(".layer-tabs button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const d=Number(btn.dataset.depth);
    depthSlider.value=d;
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
