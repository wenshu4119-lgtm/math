// Derive from the rendered prompt and numeric options, not generator parameters.
export function checkPilotQuestion(q){
 const p=q.prompt;let expected,unit,method;
 let m=p.match(/^将([\d.]+) (km|min|g)换算为(m|s|kg)，结果是/);
 if(m){const factor={'km:m':1000,'min:s':60,'g:kg':.001}[m[2]+':'+m[3]];if(!factor)throw Error('Unsupported conversion');expected=Number(m[1])*factor;unit=m[3];method='SI conversion from prompt';}
 if(expected===undefined&&(m=p.match(/^.+用([\d.]+) s(?:跑过|走过)([\d.]+) m，这段路程的平均速度/))){expected=Number(m[2])/Number(m[1]);unit='m/s';method='Total distance / elapsed time from prompt';}
 if(expected===undefined&&(m=p.match(/^.+先用([\d.]+) s走过([\d.]+) m，再用([\d.]+) s走过([\d.]+) m。两段之间不停留，全程平均速度/))){expected=(Number(m[2])+Number(m[4]))/(Number(m[1])+Number(m[3]));unit='m/s';method='Sum distance / sum time, never arithmetic mean of segment speeds';}
 if(expected===undefined&&(m=p.match(/比例尺1:(\d+).*图上距离为([\d.]+) cm，按该比例尺计算实际距离/))){expected=Number(m[1])*Number(m[2])/100000;unit='km';method='Representative fraction with matching units';}
 if(expected===undefined&&(m=p.match(/比例尺1:(\d+).*实际长度为([\d.]+) km的路线对应图上长度/))){expected=Number(m[2])*100000/Number(m[1]);unit='cm';method='Actual centimetres / scale denominator';}
 let indexes=[];
 if(expected!==undefined){indexes=q.options.flatMap((o,i)=>{const x=o.match(/^([\d.]+) (m|s|kg|m\/s|km|cm)$/);return x&&x[2]===unit&&Math.abs(Number(x[1])-expected)<1e-9?[i]:[];});}
 else if(p==='赤道的纬度是（ ）。'){expected='0°';method='NOAA latitude definition';indexes=q.options.flatMap((o,i)=>o===expected?[i]:[]);}
 else if((m=p.match(/^某地纬度为(\d+)°([NS])。仅根据纬度可以确定/))&&Number(m[1])>0&&Number(m[1])<90){expected=m[2]==='N'?'北半球':'南半球';method='Latitude sign determines north/south hemisphere only';indexes=q.options.flatMap((o,i)=>o===expected?[i]:[]);}
 else return {status:'needs_review',method:'unsupported prompt',optionIndexes:[],humanReview:false};
 const passed=indexes.length===1&&indexes[0]===q.correctOption;
 return {status:passed?'passed':'quarantined',answer:expected,unit:unit||null,optionIndexes:indexes,method,humanReview:false,reason:'从题干数值/定义推导预期结果，逐个对比全部选项，再与给定答案核对；未进行教师审核。'};
}
