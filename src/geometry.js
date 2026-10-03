// d1, d2 and baseline must share the same unit. Rays must be parallel,
// perpendicular to the baseline and strike the same straight hull side.
export function berthingAngle(d1,d2,baseline,fresh=true){
 if(!fresh||![d1,d2,baseline].every(Number.isFinite)||d1<0||d2<0||baseline<=0)return null;
 return Math.atan2(d2-d1,baseline)*180/Math.PI;
}

// Keep an unbounded rotation so crossing 359° → 1° does not spin backwards.
export function unwrapAngle(previous,next){
 if(!Number.isFinite(next))return previous;
 if(!Number.isFinite(previous))return next;
 return previous+((next-previous+180)%360+360)%360-180;
}
