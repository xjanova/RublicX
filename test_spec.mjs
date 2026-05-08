// Original test format from the user's spec — uses scramble_444.genFacelet
// directly (NOT solve4x4 driver). With my fix the driver does the rotation
// correction; the raw genFacelet alone still suffers cs0x7f's bug. Showing both:
import scramble_444 from './src/lib/vendor/cs0x7f-scramble_444.js';
import {solvedCube, parseMoves, applyMoves, isSolved} from './src/lib/cube.js';
import {solve4x4} from './src/lib/cube4x4.js';
scramble_444.init();
function rand(len){const f=['U','D','L','R','F','B'],d=["","'","2"];let s='',l='';while(s.split(' ').filter(Boolean).length<len){const x=f[~~(Math.random()*6)];if(x===l)continue;s+=(s?' ':'')+x+(Math.random()<0.5?'w':'')+d[~~(Math.random()*3)];l=x;}return s;}
const FACELET=['U','R','F','D','L','B'];
function myFL(c){let s='';for(let f=0;f<6;f++)for(let i=0;i<16;i++)s+=FACELET[c.faces[f][i]];return s;}

let passRaw=0, passDriver=0;
for (let i = 0; i < 30; i++) {
  const scr = rand(15);
  const c = solvedCube(4); applyMoves(c, parseMoves(scr));

  // Raw test as in the spec: scramble_444.genFacelet + invert
  const sol = scramble_444.genFacelet(myFL(c)).trim();
  const inv = sol.split(/\s+/).filter(Boolean).reverse().map(m=>m.endsWith("'")?m.slice(0,-1):m.endsWith('2')?m:m+"'").join(' ');
  const v = solvedCube(4); applyMoves(v, parseMoves(scr)); if(inv) applyMoves(v, parseMoves(inv));
  if (isSolved(v)) passRaw++;

  // Driver test (with rotation-correction wrapper)
  const moves = solve4x4(c);
  if (moves) {
    const v2 = solvedCube(4); applyMoves(v2, parseMoves(scr)); applyMoves(v2, moves);
    if (isSolved(v2)) passDriver++;
  }
}
console.log('Raw genFacelet+invert:', passRaw, '/30 (cs0x7f bug, expected low)');
console.log('solve4x4 driver:', passDriver, '/30 (target >28/30)');
