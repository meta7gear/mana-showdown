import test from 'node:test';
import assert from 'node:assert/strict';
import {comboBursts} from '../combo-bursts.js';

test('40 damage produces 29 one-HP hits and an 11-HP final hit',()=>{
 assert.deepEqual(comboBursts(40),[...Array(29).fill(1),11]);
});
test('larger damage uses the quotient for 29 hits and the remainder on the final hit',()=>{
 assert.deepEqual(comboBursts(100),[...Array(29).fill(3),13]);
 assert.deepEqual(comboBursts(60),Array(30).fill(2));
});
test('all damage totals preserve damage and never include zero-damage hits',()=>{
 for(let damage=1;damage<=188;damage++){
  const hits=comboBursts(damage);
  assert.equal(hits.length,Math.min(30,damage));
  assert.equal(hits.reduce((sum,hit)=>sum+hit,0),damage);
  assert.ok(hits.every(hit=>Number.isInteger(hit)&&hit>0));
 }
 assert.deepEqual(comboBursts(0),[]);
});
