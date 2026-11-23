// Servo tuner: Nano + PCA9685.  Serial Monitor 115200 baud (any line ending).
// POWER-UP = HORN MODE: ALL servos go to 90 deg (1500 us) and hold. Fit the horns now with every joint straight
// (legs straight, arms hanging straight down). Spline teeth are roughly 17 deg apart, so it won't be exact: "c" below trims the rest.
// 'a' = back to horn mode any time. The first tuning key below releases every servo except the selected one.
// ZERO CONVENTION: centre (0 deg) = 90 deg = every joint in one straight line.
// So knees/elbows only bend one way from centre: set l and h at the real stops, they need not be symmetric.
//   0-9 / n b  select channel (digits, or next / previous; previous one goes limp)     g   go to saved centre
//   + / -    nudge 10 us                                 c   centre = current position
//   . / ,    nudge 1 us                                  l/h low / high stop = current position
//   r        release (limp)    w  save to EEPROM    p  print TRIM/LO_US/HI_US block to paste into leg_test
// Workflow per servo: g, nudge until the joint is straight (neutral), c; nudge to each mechanical stop, back off a little, l and h; w.
#include <Wire.h>
#include <EEPROM.h>
#include <Adafruit_PWMServoDriver.h>
#define NCH 5                       // 5 = one leg (ch 0-4); legs 10; add arms after that (max 16)
Adafruit_PWMServoDriver pwm;
struct Cal { uint16_t magic; int16_t c[NCH], lo[NCH], hi[NCH]; } cal;
int sel = 0;
int16_t us = 1500;

void drive() { pwm.writeMicroseconds(sel, us); }
void limp(int ch) { pwm.setPWM(ch, 0, 4096); }
void show() {
  Serial.print(F("ch ")); Serial.print(sel); Serial.print(F("  us ")); Serial.print(us);
  Serial.print(F("  centre ")); Serial.print(cal.c[sel]);
  Serial.print(F("  lo ")); Serial.print(cal.lo[sel]); Serial.print(F("  hi ")); Serial.println(cal.hi[sel]);
}
void nudge(int d) { us = constrain(us + d, 500, 2500); drive(); show(); }
bool hornMode = false;
void all90() {
  for (int i = 0; i < NCH; i++) pwm.writeMicroseconds(i, 1500);
  us = 1500; hornMode = true;
  Serial.println(F("HORN MODE: all servos at 90 deg (1500us). Fit horns now. Any tuning key releases them."));
}
bool isTune(char k) {
  return (k >= '0' && k < '0' + NCH) || k == 'n' || k == 'b' || k == '+' || k == '-' || k == '.' || k == ',' ||
         k == 'g' || k == 'c' || k == 'l' || k == 'h' || k == 'r';
}
void row(const char* name, const int16_t* v, int off) {
  Serial.print(F("const int16_t ")); Serial.print(name); Serial.print('['); Serial.print(NCH); Serial.print(F("] = {"));
  for (int i = 0; i < NCH; i++) { Serial.print(v[i] - off); Serial.print(i < NCH - 1 ? ',' : '}'); }
  Serial.println(';');
}
void block() { row("TRIM", cal.c, 1500); row("LO_US", cal.lo, 0); row("HI_US", cal.hi, 0); }   // stops are absolute us, any asymmetry kept

void setup() {
  Serial.begin(115200);
  Wire.begin();
  pwm.begin();
  pwm.setOscillatorFrequency(27000000);
  pwm.setPWMFreq(50);
  EEPROM.get(0, cal);
  if (cal.magic != 0xCA1B) {        // first run: centre 1500us, +-40 deg until you measure
    cal.magic = 0xCA1B;
    for (int i = 0; i < NCH; i++) { cal.c[i] = 1500; cal.lo[i] = 1500 - 440; cal.hi[i] = 1500 + 440; }
  }
  Serial.println(F("tuner: a horn mode | 0-9 n b select | g | +/- 10us | ./, 1us | c | l h | r | w | p"));
  all90();
}

void loop() {
  if (!Serial.available()) return;
  char k = Serial.read();
  if (hornMode && isTune(k)) { for (int i = 0; i < NCH; i++) limp(i); hornMode = false; }
  if (k == 'a') all90();
  else if (k >= '0' && k < '0' + NCH) { limp(sel); sel = k - '0'; us = cal.c[sel]; show(); }
  else if (k == 'n' || k == 'b') { limp(sel); sel = (sel + (k == 'n' ? 1 : NCH - 1)) % NCH; us = cal.c[sel]; show(); }
  else if (k == '+') nudge(10);
  else if (k == '-') nudge(-10);
  else if (k == '.') nudge(1);
  else if (k == ',') nudge(-1);
  else if (k == 'g') { us = cal.c[sel]; drive(); show(); }
  else if (k == 'c') { cal.c[sel] = us; show(); }
  else if (k == 'l') { cal.lo[sel] = us; show(); }
  else if (k == 'h') { cal.hi[sel] = us; show(); }
  else if (k == 'r') { limp(sel); Serial.println(F("limp")); }
  else if (k == 'w') { EEPROM.put(0, cal); Serial.println(F("saved")); }
  else if (k == 'p') block();
}
