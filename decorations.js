// UI ornamentation stays separate from the interactive card scene.
export function decorateBoard() {
  const sigil = (id) => {
    const ticks = Array.from({length:60},(_,i)=>`<line x1="150" y1="${i%5===0?8:12}" x2="150" y2="${i%5===0?19:16}" transform="rotate(${i*6} 150 150)"/>`).join('');
    const glyphs = ['◇','✧','△','♠','◇','✧','△','♣'].map((g,i)=>`<text x="150" y="40" transform="rotate(${i*45} 150 150)" text-anchor="middle" fill="currentColor" stroke="none" font-size="13">${g}</text>`).join('');
    return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><path id="orbit-${id}" d="M150,24a126,126 0 1,1 -0.1,0"/></defs><g fill="none" stroke="currentColor" stroke-width="1"><circle cx="150" cy="150" r="146" stroke-width="1.7"/><circle cx="150" cy="150" r="140" opacity=".6"/>${ticks}<circle cx="150" cy="150" r="115" stroke-width="1.2"/><circle cx="150" cy="150" r="109" opacity=".5"/><path d="M150 42L244 204H56Z M150 258L56 96H244Z" opacity=".65"/><rect x="75" y="75" width="150" height="150" rx="8" transform="rotate(45 150 150)" opacity=".45"/><circle cx="150" cy="150" r="97" stroke-dasharray="86 22 3 12" stroke-width="2"/>${glyphs}</g><text fill="currentColor" font-size="5.5" letter-spacing="2.5" font-family="monospace"><textPath href="#orbit-${id}">LIFE CORE • RESERVE SYSTEM • THIRTEEN • IGNITION ◇ OVERDRIVE ◇ </textPath></text></svg>`;
  };
  document.querySelectorAll('.sigil-art').forEach((element,index)=>element.innerHTML=sigil(`player-${index}`));
  const motes=document.querySelector('.ambient-motes');
  for(let i=0;i<40;i++){
    const dot=document.createElement('i');
    dot.className=i%3===0?'cross':i>19?'cyan':'';
    // Deterministic placement keeps the UI stable across deals and hot reloads.
    dot.style.cssText=`left:${3+(i*37.71)%94}%;top:${3+(i*23.43)%93}%;width:${i%5===0?4:2}px;height:${i%5===0?4:2}px;animation-delay:-${i*.61}s;animation-duration:${6+i%7}s`;
    motes.append(dot);
  }
}
