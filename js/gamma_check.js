// Descriptive candidate comparison. No architecture, fraud or capacity inference.
export function gammaPade(theta, T) {
  if (!Number.isFinite(theta) || theta <= 0 || !Number.isFinite(T) || T < 0) return NaN;
  const z = T * Math.SQRT2 / theta;
  return Number.isFinite(z) ? (2-z)/(2+z) : -1;
}
export function thetaEffPade(theta, T) {
  return Number.isFinite(theta) && theta > 0 && Number.isFinite(T) && T >= 0 ? theta + T/Math.SQRT2 : NaN;
}
export function thetaLinearInverse(gObs, T) {
  return Number.isFinite(gObs) && gObs < 1 && Number.isFinite(T) && T > 0 ? T*Math.SQRT2/(1-gObs) : NaN;
}
export function thetaInverse(gObs, T) {
  return Number.isFinite(gObs) && gObs > -1 && gObs < 1 && Number.isFinite(T) && T > 0
    ? T*Math.SQRT2*(1+gObs)/(2*(1-gObs)) : NaN;
}
// Compatibility name: schema v2 explicitly reports the Padé inverse.
export const thetaEffObserved = thetaInverse;
export function efficiency(a, b) {
  return Number.isFinite(a) && a > 0 && Number.isFinite(b) && b > 0 ? a/b : NaN;
}
export function deltaHCardy(a, b) {
  const ratio = efficiency(a,b);
  return Number.isFinite(ratio) ? Math.log(ratio) : NaN; // log ratio, no entropy claim
}
export function classifyRegime(_ratio, gObs, _isRandom) {
  if (!Number.isFinite(gObs)) return "unknown";
  return gObs <= -1 || gObs >= 1 ? "outside_inverse" : "descriptive";
}
export function gammaCheckAll({theta, T, gObs, isRandom}) {
  const candidate=gammaPade(theta,T), inverse=thetaInverse(gObs,T);
  return {
    schemaVersion:2, gammaPade:candidate, gammaObserved:Number.isFinite(gObs)?gObs:null,
    residual:Number.isFinite(gObs) ? gObs-candidate : NaN,
    thetaInverse:inverse, thetaLinearInverse:thetaLinearInverse(gObs,T),
    thetaShifted:thetaEffPade(theta,T), thetaNominal:theta,
    thetaEffPade:thetaEffPade(theta,T), thetaEffObs:inverse,
    efficiency:efficiency(inverse,theta), deltaHCardy:deltaHCardy(inverse,theta),
    regime:classifyRegime(null,gObs,isRandom),
    interpretation:"algebraic_coordinates_not_capacity_or_architecture",
    corpus:isRandom?"random":"unspecified_text",
  };
}
export const REGIME_META={
  descriptive:{emoji:"ℹ️",cls:"v-deg"}, outside_inverse:{emoji:"ℹ️",cls:"v-deg"},
  unknown:{emoji:"❓",cls:"v-deg"},
};
