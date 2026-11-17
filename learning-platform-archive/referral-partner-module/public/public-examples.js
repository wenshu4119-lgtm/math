// Public, fixed synthetic material only. No API, session or storage access.
const checkbox=document.querySelector('#checked'),status=document.querySelector('#status'),buttons=[...document.querySelectorAll('.toolbar button')];
checkbox.addEventListener('change',()=>buttons.forEach(b=>b.disabled=!checkbox.checked));
for(const button of buttons)button.addEventListener('click',()=>{if(!checkbox.checked)return;try{window.print();status.textContent='已打开系统打印预览。请选择A4及另存为PDF或打印机；取消不会保存文件。';}catch{status.textContent='无法打开系统打印，请使用浏览器菜单中的打印功能。';}});
