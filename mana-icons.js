// Shared vector silhouettes and inset details for spell and tableau symbols.
const icons={
 fire:{shape:'M12 1.5C13.5 6.6 19.8 8.3 20.2 14.1C20.7 19.1 17.2 22.5 12 22.5C6.8 22.5 3.3 19.1 3.8 14.1C4.1 10.8 6.1 8.2 8.1 6.3C7.7 9.7 8.8 11.3 10.2 11.7C12.2 8.8 12.6 5.4 12 1.5Z M12.1 13.2C11.6 15.5 8.8 16.8 9.1 19C9.3 20.5 10.5 21.3 12 21.3C13.9 21.3 15.1 20.1 15 18.5C14.9 16.7 13.1 15.6 12.1 13.2Z'},
 earth:{shape:'M3.2 20.8C3.9 18 2.4 12.6 6.1 8.2C9.8 3.7 16.1 4.7 21.3 2.5C21.2 7.8 22.1 14.1 17.7 17.8C13.3 21.6 7.8 19.8 3.2 20.8Z',detail:'M4.6 19.4L17.8 6.8M8.8 15.4L8.5 10.8M12.4 12L17 12.3'},
 water:{shape:'M12 1.5C10.7 5.5 3.7 11.3 3.7 15.6C3.7 20.1 7.3 22.5 12 22.5C16.7 22.5 20.3 20.1 20.3 15.6C20.3 11.3 13.3 5.5 12 1.5Z M6.7 15.3C6.1 18.5 8.4 20.4 11.4 20.3L11.4 18.7C9.2 18.7 8.1 17.6 8.3 15.3Z'},
 white:{shape:'M12 21.8L3.8 13.6C0.2 10 1.9 3.5 6.6 3.5C9 3.5 10.7 4.7 12 6.5C13.3 4.7 15 3.5 17.4 3.5C22.1 3.5 23.8 10 20.2 13.6Z M11 9.2V12H8.2V14H11V16.8H13V14H15.8V12H13V9.2Z'},
};
export function manaIcon(mana){
 const {shape,detail}=icons[mana];
 return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${shape}" fill="currentColor" fill-rule="evenodd"/>${detail?`<path d="${detail}" fill="none" stroke="var(--spell-core, #16352c)" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>`:''}</svg>`;
}
export function drawManaIcon(ctx,mana,x,y,size){
 const {shape,detail}=icons[mana];
 ctx.save();ctx.translate(x-size/2,y-size/2);ctx.scale(size/24,size/24);
 ctx.fill(new Path2D(shape),'evenodd');
 if(detail){
  // Subtract the veins so the tableau background shows through.
  ctx.globalCompositeOperation='destination-out';ctx.strokeStyle='#000';
  ctx.lineWidth=1.35;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(new Path2D(detail));
 }
 ctx.restore();
}
