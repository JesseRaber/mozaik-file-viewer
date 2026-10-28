import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import {checkCutlist,parseCutlist,readCutlistArchive} from "./cutlist.ts";
import {parseDes} from "./parse/des.ts";
import type {Job,Product} from "./types.ts";
// Synthetic fixtures only; real Mozaik exports carry customer data and stay out of the repository.
type P=[name:string,W:number,L:number,qty?:number,report?:string];
const cab=(uid:string,cabNo:string,parts:P[],quantity=1):Product=>({sourceUID:uid,name:`Cab ${cabNo}`,cabNo,quantity,width:600,height:800,depth:600,wall:"",wallX:0,elev:0,sourceLib:"",desc:"",fasteners:[],
 parts:parts.map(([name,W,L,qty=1,report],id)=>({id,name,reportName:report,type:"Unknown",layer:0,qty,W,L,thickness:19,thicknessSource:"default",pos:[0,0,0],rot:[],shape:[],holes:[],grooves:[],hardware:""}))});
const job=(...products:Product[]):Job=>({jobName:"Kitchen",customer:"",rooms:[{name:"Room 1",file:"Room1.des",walls:[],products,doorStyle:null}],runs:{},cncFiles:[],parms:[],warnings:[],source:"files"});
type R=[uid:string,name:string,W:number,L:number,qty?:number];
const xml=(rows:R[],jobName="Kitchen")=>`<?xml version="1.0"?><AssemblyCutlistData JobName="${jobName}" RunName="Run 1"><Room>${rows.map(([uid,n,W,L,q=1])=>`<CutlistItem Name="${n}" ReportName="${n}" W="${W}" L="${L}" Quan="${q}" CabUniqueID="${uid}" CabNumber="1" RoomName="Room 1" CutlistType="Case Parts"/>`).join("")}</Room></AssemblyCutlistData>`;
const run=(j:Job,rows:R[])=>checkCutlist(j,parseCutlist(xml(rows),"t.mzkcut"));
const statuses=(c:ReturnType<typeof run>)=>c.cabinets[0].rows.map(r=>`${r.status}:${r.name}`).sort();

test("reads AppData.xml from a UTF-16 .mzkcut archive",async()=>{
 const text=xml([["10","Bottom",500,560]]);
 const u16=new Uint8Array(2+text.length*2);u16[0]=0xff;u16[1]=0xfe;
 for(let i=0;i<text.length;i++){u16[2+i*2]=text.charCodeAt(i);u16[3+i*2]=0;}
 const zip=new JSZip();zip.file("AppData.xml",u16);zip.file("ManifestData.xml","<M/>");
 const cut=await readCutlistArchive(await zip.generateAsync({type:"arraybuffer"}),"t.mzkcut");
 assert.deepEqual([cut.jobName,cut.runName,cut.rows.length,cut.rows[0].reportName,cut.rows[0].W],["Kitchen","Run 1",1,"Bottom",500]);
});
test("rejects files that are not cutlist exports or have invalid rows",async()=>{
 const zip=new JSZip();zip.file("LabelData.xml","<LabelData/>");
 await assert.rejects(readCutlistArchive(await zip.generateAsync({type:"arraybuffer"}),"x.mzkcut"),/AppData\.xml/);
 assert.throws(()=>parseCutlist("<Other/>","x"),/Not a Mozaik cutlist/);
 assert.throws(()=>parseCutlist(xml([["10","Bottom",500,560,1.5]]),"x"),/invalid rows/);
 assert.throws(()=>parseCutlist(xml([]),"x"),/no cutlist rows/);
});
test("the loader keeps ReportName for the cutlist key",()=>{
 const r=parseDes('<Room Name="R"><Products><Product UniqueID="7" CabNo="1"><CabProdParts><CabProdPart Name="Left End" ReportName="FEnd (L)" Type="End" L="800" W="600" Quan="1"/><CabProdPart Name="Bottom" Type="Bottom" L="500" W="500" Quan="1"/></CabProdParts></Product></Products></Room>',"Room1.des");
 assert.deepEqual(r.room!.products[0].parts.map(p=>p.reportName),["FEnd (L)",undefined]);
});
test("matches by ReportName and size within 0.1 mm; cabinet build quantity multiplies",()=>{
 const c=run(job(cab("10","1",[["Left End",600,800,1,"FEnd (L)"],["Bottom",560,500,2]],2)),[["10","FEnd (L)",600.05,800,2],["10","Bottom",560,500.04,4]]);
 assert.deepEqual(c.units,{match:6,expected:0,differs:0,"job-only":0,"export-only":0});
 assert.deepEqual(c.warnings,[]);
});
test("a 0.2 mm size change is flagged, not matched",()=>{
 const c=run(job(cab("10","1",[["Bottom",560,500]])),[["10","Bottom",560,500.2]]);
 assert.deepEqual(statuses(c),["differs:Bottom"]);
});
test("known export differences are labelled expected, not errors",()=>{
 const c=run(job(cab("10","1",[["Door",400,700],["Door L Stile",57,700],["Door TR",57,286],["Drw Panel",120,300],["Adjustable Shelf",437.7245,733.1075],["UEnd (L)",600,800]])),
  [["10","Door",400,700],["10","Toe Skin",100,2400],["10","Counter Top",640,2400],["10","Adjustable Shelf",436.137,733.1075],["10","End (L)",600,800],["10","Panelized End",600,800]]);
 assert.deepEqual(c.units,{match:1,expected:8,differs:0,"job-only":0,"export-only":0});
 assert.ok(c.cabinets[0].rows.filter(r=>r.status==="expected").every(r=>r.note));
});
test("appliance-adjacent regeneration is flagged in red",()=>{
 // Apps Runs 4/5/8: box parts 6.273 mm shorter and the finished end exported as an unfinished end.
 const c=run(job(cab("10","3",[["Bottom",569.487,747.395],["Nailer",76.2,741.045,2],["FEnd (R)",609.6,876.3]])),
  [["10","Bottom",569.487,741.122],["10","Nailer",76.2,734.772,2],["10","UEnd (R)",593.725,876.3]]);
 assert.deepEqual(statuses(c),["differs:Bottom","differs:Nailer","export-only:UEnd (R)","job-only:FEnd (R)"]);
 assert.deepEqual(c.units,{match:0,expected:0,differs:3,"job-only":1,"export-only":1});
});
test("a different revision warns and compares only shared cabinets",()=>{
 const c=run(job(cab("10","1",[["Bottom",560,500]]),cab("11","2",[["Bottom",560,500]])),[["10","Bottom",560,500],["12","Bottom",300,500]]);
 assert.deepEqual([c.cabinets.length,c.jobOnlyCabinets.map(x=>x.cabNo),c.exportOnlyCabinets.map(x=>x.uid)],[1,["2"],["12"]]);
 assert.match(c.warnings.join(" "),/different revision/);
});
test("an export from another job is refused",()=>{
 assert.throws(()=>run(job(cab("10","1",[["Bottom",560,500]])),[["99","Bottom",560,500]]),/No cabinet in this cutlist export matches/);
});
test("a differing export job name is reported, matching still uses cabinet IDs",()=>{
 const c=checkCutlist(job(cab("10","1",[["Bottom",560,500]])),parseCutlist(xml([["10","Bottom",560,500]],"Other Job"),"t.mzkcut"));
 assert.equal(c.units.match,1);assert.match(c.warnings.join(" "),/differs from the loaded folder/);
});
