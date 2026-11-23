// Single-leg test: Arduino Nano + PCA9685 + 5 MG90S.  Serial Monitor 115200 baud, "Newline" line ending.
// ch0 hip yaw | ch1 hip pitch | ch2 knee | ch3 ankle pitch | ch4 ankle roll
// 0 deg = neutral = leg straight (same convention as the arms: hanging straight down, all joints in line)
//   c            all joints to 0 deg (servo centre)
//   m <ch> <deg> move one joint, e.g. "m 2 10"
//   z <mm>       squat via IK: pelvis lowers <mm> (0..~15), foot stays flat, e.g. "z 3"
//   s            sweep every joint +-15 deg, one at a time
//   ?            print current angles
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
Adafruit_PWMServoDriver pwm;

// ---- calibration knobs: tune these on the bench ----
const int8_t  SIGN[5] = { 1, 1, 1, 1, 1 };               // -1 if a joint moves the wrong way
const int16_t TRIM[5] = { 0, 0, 0, 0, 0 };               // us added at 0 deg, to centre each servo
const int16_t LO_US[5] = { 1060, 730, 730, 730, 1060 };  // absolute us of each joint's two stops: paste from tuner "p".
const int16_t HI_US[5] = { 1940, 2270, 2270, 2270, 1940 };// One-sided joints (knee) are fine: e.g. LO_US = centre.
const float   US_DEG  = 11.0;                            // us per degree (MG90S ~500-2400us = 180deg)
const float   MAXDPS  = 60;                              // slew limit, deg/s
// ponytail: planar IK only (hip/knee/ankle pitch). Yaw and roll are driven by hand with "m".

float cur[5], tgt[5], ANG_LO[5], ANG_HI[5];

void limits() {                                          // us stops -> degree limits; handles SIGN and one-sided joints
  for (int i = 0; i < 5; i++) {
    float a = SIGN[i] * (LO_US[i] - 1500 - TRIM[i]) / US_DEG, b = SIGN[i] * (HI_US[i] - 1500 - TRIM[i]) / US_DEG;
    ANG_LO[i] = a < b ? a : b; ANG_HI[i] = a < b ? b : a;
  }
}
bool inLim(int i, float q) { return q >= ANG_LO[i] && q <= ANG_HI[i]; }
void out(int i) { pwm.writeMicroseconds(i, (uint16_t)(1500 + TRIM[i] + SIGN[i] * cur[i] * US_DEG)); }
void setT(int i, float d) { tgt[i] = constrain(d, ANG_LO[i], ANG_HI[i]); }
bool moving() { for (int i = 0; i < 5; i++) if (fabs(tgt[i] - cur[i]) > 0.05) return true; return false; }
void step() {                                            // call every 20 ms
  const float s = MAXDPS * 0.02;
  for (int i = 0; i < 5; i++) { cur[i] += constrain(tgt[i] - cur[i], -s, s); out(i); }
}
void waitDone() { while (moving()) { step(); delay(20); } }

// IK-BEGIN
// Leg link vectors (y,z mm) from the CAD: hip->knee, knee->ankle at neutral. Foot kept flat.
static float wrap(float a) { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; }
bool legIK(float dz, float &q1, float &q2, float &q3) {  // degrees out
  const float v1y = -1.214, v1z = -40.334, v2y = 0.666, v2z = -54.996;
  float ty = v1y + v2y, tz = v1z + v2z + dz;
  float l1 = hypot(v1y, v1z), l2 = hypot(v2y, v2z);
  float c = (ty * ty + tz * tz - l1 * l1 - l2 * l2) / (2 * l1 * l2);
  if (c > 1.000001 || c < -1) return false;              // out of reach (leg is straight at neutral: dz<0 impossible)
  c = c > 1 ? 1 : c;
  float a1 = atan2(v1z, v1y), a2 = atan2(v2z, v2y), ac = acos(c);
  float qa = wrap(ac - (a2 - a1)), qb = wrap(-ac - (a2 - a1));
  float r2 = fabs(qa) < fabs(qb) ? qa : qb;
  float ex = v1y + v2y * cos(r2) - v2z * sin(r2), ez = v1z + v2y * sin(r2) + v2z * cos(r2);
  float r1 = atan2(tz, ty) - atan2(ez, ex);
  q1 = r1 * RAD_TO_DEG; q2 = r2 * RAD_TO_DEG; q3 = -(q1 + q2);
  return true;
}
// IK-END

void setup() {
  Serial.begin(115200);
  Wire.begin();
  pwm.begin();
  pwm.setOscillatorFrequency(27000000);                  // tune if servos run slightly fast/slow
  pwm.setPWMFreq(50);
  delay(10);
  limits();
  for (int i = 0; i < 5; i++) out(i);                  // servos snap to centre NOW: horns off / leg unloaded on first power-up
  Serial.println(F("ready: c | m ch deg | z mm | s | ?"));
}

void loop() {
  static uint32_t t = 0;
  if (millis() - t >= 20) { t += 20; step(); }
  if (!Serial.available()) return;
  char k = Serial.read();
  if (k == '\n' || k == '\r' || k == ' ') return;
  if (k == 'c') { for (int i = 0; i < 5; i++) setT(i, 0); }
  else if (k == 'm') { int ch = Serial.parseInt(); float d = Serial.parseFloat();
    if (ch < 0 || ch > 4) Serial.println(F("ch 0-4")); else setT(ch, d); }
  else if (k == 'z') { float dz = Serial.parseFloat(), q1, q2, q3;
    if (!legIK(dz, q1, q2, q3)) Serial.println(F("unreachable"));
    else if (!inLim(1, q1) || !inLim(2, q2) || !inLim(3, q3)) Serial.println(F("outside servo limits"));
    else { setT(1, q1); setT(2, q2); setT(3, q3); Serial.print(q1); Serial.print(' '); Serial.print(q2); Serial.print(' '); Serial.println(q3); } }
  else if (k == 's') { for (int i = 0; i < 5; i++) { setT(i, 15); waitDone(); setT(i, -15); waitDone(); setT(i, 0); waitDone(); } }
  else if (k == '?') { for (int i = 0; i < 5; i++) { Serial.print(cur[i]); Serial.print(' '); } Serial.println(); }
}
