// Only recognize standalone integer fractions. Unsupported notation remains exact text.
export function fractionSegments(value){
  const text=String(value),parts=[],urls=[...String(value).matchAll(/\b(?:https?:\/\/|www\.)\S+/gi)].map(m=>[m.index,m.index+m[0].length]);let last=0;
  for(const m of text.matchAll(/(?<![\w./])(\d{1,2})\/(\d{1,2})(?![\w./])/g)){
    if(urls.some(([start,end])=>m.index>=start&&m.index<end))continue;
    if(m.index>last)parts.push({text:text.slice(last,m.index)});
    parts.push({numerator:m[1],denominator:m[2]});last=m.index+m[0].length;
  }
  if(last<text.length||!parts.length)parts.push({text:text.slice(last)});
  return parts;
}
