window.TWP = window.TWP || {};
const PEOPLE = [
  {name:'Danisa',initials:'D'},{name:'Julian',initials:'J'},{name:'Carmen',initials:'C'},
  {name:'José Miguel',initials:'JM'},{name:'Dioris',initials:'DG'},{name:'Sileni',initials:'S'},
  {name:'Melonie',initials:'M'},{name:'Neisha',initials:'N'},{name:'Kailey',initials:'K'},
  {name:'Guaroa',initials:'G'},{name:'Mane',initials:'MN'}
];
const TIMEFRAMES = [
  {code:'22mo',label:'22MO',order:0},{code:'16mo',label:'16MO',order:1},
  {code:'12mo',label:'12MO',order:2,isNow:true},{code:'7mo',label:'7MO',order:3},
  {code:'3mo',label:'3MO',order:4},{code:'1mo',label:'1MO',order:5},{code:'1wk',label:'1WK',order:6}
];
const TASKS = [
  {id:'t1',title:'The Flowers',parent:'The Flowers',tags:['Flora'],timeframe:'12mo',phase:'Execute',status:'In Progress',assignees:['Sileni'],
   subtasks:[{id:'s1',parent:'The Flowers',title:'Confirm florist quote',status:'In Progress',assignees:['Sileni']},
             {id:'s2',parent:'The Flowers',title:'Pick arch blooms',status:'Not Started',assignees:['Sileni','Melonie']}]},
  {id:'t2',title:'The Music',parent:'The Music',tags:['Music'],timeframe:'16mo',phase:'Decide',status:'Needs Help',assignees:['Mane'],
   subtasks:[{id:'s3',parent:'The Music',title:'Church band inquiry',status:'Needs Help',assignees:['Mane']}]},
  {id:'t3',title:'The Rings',parent:'The Rings',tags:['Decor'],timeframe:'12mo',phase:'Execute',status:'In Progress',assignees:['Danisa','Julian'],
   subtasks:[{id:'s4',parent:'The Rings',title:'Choose wooden box',status:'In Progress',assignees:['Danisa','Julian']}]},
  {id:'t4',title:'The Coordinator',parent:'The Coordinator',tags:['Logistics'],timeframe:'12mo',phase:'Execute',status:'Complete',assignees:['Dioris'],
   subtasks:[{id:'s5',parent:'The Coordinator',title:'Confirm day-of timeline',status:'Complete',assignees:['Dioris']}]}
];
const MOCK={people:PEOPLE,timeframes:TIMEFRAMES,tasks:TASKS,rsvp:{total:130,confirmed:14,declined:2,awaiting:114}};
async function apiGet(path){return (path in MOCK)?MOCK[path]:null;}
async function apiPost(){return{ok:false};}
window.TWP.api={get:apiGet,post:apiPost,config:{}};
