import assert from "node:assert/strict";
import test from "node:test";
import {loadItems} from "./parse/load.ts";
import {parseDes} from "./parse/des.ts";
import {parseOpt} from "./parse/opt.ts";
import {parseGcode} from "./parse/gcode.ts";
import {computeFrame} from "./geom.ts";
import {buildDemoJob} from "./demo.ts";
import {partRowKey,sourceQuantity} from "./part-identity.ts";
import {frac} from "./units.ts";
import {setJob,state} from "./store.ts";
const room = '<Room Name="Room1"><Products><Product ProdName="Cabinet" CabNo="1" Width="600" Height="800" Depth="600"><CabProdParts><CabProdPart Name="Bottom" Type="Bottom" L="500" W="500" Quan="3"/></CabProdParts></Product></Products></Room>';
const file=(path:string,text:string)=>({path,name:path.split("/").at(-1)!,text:async()=>text,raw:async()=>new TextEncoder().encode(text).buffer});
const opt=(run:number,th:number,assy:string,name="Bottom")=>`<OptimizeMaterial RunId="${run}" Name="Stock ${th}" Thickness="${th}"><OptimizePart PartID="100" Name="${name}" Length="500" Width="500" AssyNo="${assy}"/></OptimizeMaterial>`;
const label=(job:string,run:string,th:number)=>`<JobData><LabelData JobName="${job}" RunName="${run}"><Material Name="Stock" Thickness="${th}"><Sheet ID="1"><Part Name="Bottom" L="500" W="500" AssyNo="R1C1" PartNo="8"/></Sheet></Material></LabelData></JobData>`;
const part=(job:Awaited<ReturnType<typeof loadItems>>)=>job.rooms[0].products[0].parts[0];
test("quantity three stays three; zero records are excluded",()=>{
 assert.equal(sourceQuantity(parseDes(room,"Room1.des").room!.products[0].parts[0]),3);
 assert.equal(parseDes(room.replace('Quan="3"','Quan="0"'),"Room1.des").room!.products[0].parts.length,0);
});
test("invalid dimensions and quantities reject the room",()=>{
 for(const xml of [room.replace('L="500"','L="invalid"'),room.replace('Quan="3"','Quan="-1"'),room.replace('Quan="3"','Quan="1.5"')]) {
  const r=parseDes(xml,"Room1.des");assert.equal(r.room,null);assert.ok(r.warning);
 }
});
test("row identities distinguish material, thickness, machining and exact dimensions",()=>{
 const p=parseDes(room,"Room1.des").room!.products[0].parts[0];
 for(const patch of [{thickness:6},{material:"Other"},{L:500.2},{holes:[{x:1,y:2,dia:5,depth:3,flip:false}]}]) assert.notEqual(partRowKey(p),partRowKey({...p,...patch}));
});
test("optimizer uses matching cabinet rather than first run",async()=>{
 const j=await loadItems([file("Job/Room1.des",room),file("Job/old.opt",opt(1,12.7,"R9C99")),file("Job/current.opt",opt(2,19.05,"R1C1"))]);assert.equal(part(j).thickness,19.05);
});
test("ambiguous optimizer revisions leave defaults with warning",async()=>{
 const j=await loadItems([file("Job/Room1.des",room),file("Job/a.opt",opt(1,6,"R1C1")),file("Job/b.opt",opt(2,19.05,"R1C1"))]);assert.equal(part(j).thicknessSource,"default");assert.ok(j.warnings.some(w=>/Ambiguous/.test(w.message)));
});
test("blank names and assembly identities never supply thickness",async()=>{
 for(const data of [opt(1,6,"R1C1",""),opt(1,6,"")]) {const j=await loadItems([file("Job/Room1.des",room),file("Job/a.opt",data)]);assert.equal(part(j).thicknessSource,"default");}
});
test("optimizer materials retain only their own parts",()=>{
 const r=parseOpt(`<Root>${opt(1,6,"R1C1","Thin")}${opt(1,19,"R1C1","Thick")}</Root>`,"test.opt");assert.deepEqual(r.run?.materials.map(m=>m.parts.map(p=>p.name)),[["Thin"],["Thick"]]);
});
test("mixed job folders are rejected",async()=>{
 await assert.rejects(loadItems([file("Jobs/JobA/Room1.des",room),file("Jobs/JobB/Room1.des",room)]),/Multiple job folders/);
});
test("foreign export cannot overwrite explicit thickness",async()=>{
 const j=await loadItems([file("JobA/Room1.des",room.replace('Quan="3"','Thickness="19.05" Quan="1"')),file("JobA/Other-LabelStatus.xml",label("Other Job","Run 99",6))]);assert.equal(part(j).thickness,19.05);assert.equal(j.paperless,undefined);assert.ok(j.warnings.length);
});
test("same-job conflicting thickness preserves XML and warns",async()=>{
 const j=await loadItems([file("JobA/Room1.des",room.replace('Quan="3"','Thickness="19.05" Quan="1"')),file("JobA/LabelStatus.xml",label("JobA","Run 1",6))]);assert.equal(part(j).thickness,19.05);assert.ok(j.warnings.some(w=>/Conflicting/.test(w.message)));
});
test("multiple exports require selection instead of size precedence",async()=>{
 const j=await loadItems([file("JobA/Room1.des",room),file("JobA/a-LabelStatus.xml",label("JobA","Run 1",6)),file("JobA/b-LabelStatus.xml",label("JobA","Run 2",19.05))]);assert.equal(j.paperless,undefined);assert.ok(j.warnings.some(w=>/Multiple exports/.test(w.message)));
});
test("standalone TXT can load without rooms",async()=>{
 const j=await loadItems([file("program.TXT","G21 G90\nG0 X0 Y0 Z5\nG1 Z-1\nG1 X5")]);assert.equal(j.rooms.length,0);assert.equal(j.cncFiles.length,1);
});
test("relative moves and compact unit commands",()=>{
 const g=parseGcode("G21G90\nG0 X10 Y10 Z0\nG91\nG1 X5 Y0 Z-1","relative");assert.deepEqual(g.episodes.at(-1)?.pts.at(-1),[15,10,-1]);assert.equal(g.unit,"mm");
});
test("radius arcs end at requested point",()=>{
 for(const d of ["G2","G3"]) {const g=parseGcode(`G21G90\nG0 X0 Y0 Z0\n${d} X10 Y0 R5`,"arc");assert.deepEqual(g.episodes.at(-1)?.pts.at(-1),[10,0,0]);assert.equal(g.warnings.length,0);}
});
test("rapids split episodes and vertical plunges retain Z",()=>{
 const g=parseGcode("G21 G90\nG0 X0 Y0 Z2\nG1 Z-1\nG0 X20 Y20 Z2\nG1 Z-1","drill");assert.equal(g.episodes.length,2);assert.deepEqual(g.episodes[1].pts,[[20,20,2],[20,20,-1]]);
});
test("positive inch cuts retain millimetre thickness",()=>{
 const g=parseGcode("G20 G90\nG0 X0 Y0 Z1.5\nG1 Z0.76\nG1 X2\nG0 Z1.5","inch");assert.equal(g.episodes.length,1);assert.ok(Math.abs(g.thickness!-19.304)<0.001);
});
test("unsupported coordinate/canned-cycle commands withhold preview",()=>{
 for(const code of ["G92 X5","G81 X5 Y5 Z-2","G18 G2 X2 Z-1 I1 K0","G43 H1"]){const g=parseGcode(`G21 G90\nG1 X1 Y1 Z-1\n${code}`,"unsupported");assert.equal(g.episodes.length,0);assert.ok(g.warnings.length);}
});
test("frame invents no pocket operations",()=>{assert.equal(computeFrame(buildDemoJob().rooms[0].products[0])!.members.flatMap(m=>m.pockets).length,0);});
test("negative fractions retain sign and magnitude",()=>{assert.equal(frac(-6.35),'-1/4"');assert.equal(frac(-25.4),'-1"');});
test("new job resets title/customer",()=>{const a=buildDemoJob();a.jobName="A";a.customer="A";setJob(a);const b=buildDemoJob();b.jobName="B";b.customer="B";setJob(b);assert.equal(state.title.job,"B");assert.equal(state.title.customer,"B");});

test("cabinet-only labels cannot cross multiple rooms",async()=>{
 const j=await loadItems([file("Job/Room1.des",room),file("Job/Room2.des",room),file("Job/a.opt",opt(1,6,"C1"))]);
 assert.ok(j.rooms.every(r=>r.products[0].parts[0].thicknessSource==="default"));
});
test("duplicate cabinet IDs withhold optimizer associations",async()=>{
 const duplicated=room.replace("</Products>",room.match(/<Product .*<\/Product>/)![0]+"</Products>");
 const j=await loadItems([file("Job/Room1.des",duplicated),file("Job/a.opt",opt(1,6,"R1C1"))]);
 assert.ok(j.rooms[0].products.every(p=>p.parts[0].thicknessSource==="default"));assert.ok(j.warnings.length);
});
