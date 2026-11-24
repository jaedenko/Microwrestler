// Servo bridge for the web page: Nano + PCA9685, 115200 baud.
// Frame: "P u0 u1 u2 ...\n"  u = pulse in us for channel n, 0 = release. No frame for 2 s -> release all.
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
Adafruit_PWMServoDriver pwm;
char buf[112]; uint8_t n = 0; uint16_t last[16]; uint32_t seen = 0; bool live = false;
void put(int ch, int us) {
  if (us == last[ch]) return; last[ch] = us;
  if (us == 0) pwm.setPWM(ch, 0, 4096); else pwm.writeMicroseconds(ch, constrain(us, 500, 2500));
}
void parse() {
  if (buf[0] == '?') { Serial.println(F("bridge ready")); return; }   // handshake: the web page asks if anyone is there
  if (buf[0] != 'P') return;
  char* p = buf + 1;
  for (int ch = 0; ch < 16; ch++) { while (*p == ' ') p++; if (!*p) break; put(ch, atoi(p)); while (*p && *p != ' ') p++; }
  seen = millis(); live = true;
}
void setup() {
  Serial.begin(115200); Wire.begin(); Wire.setClock(400000);
  pwm.begin(); pwm.setOscillatorFrequency(27000000); pwm.setPWMFreq(50);
  for (int i = 0; i < 16; i++) { last[i] = 1; put(i, 0); }
  Serial.println(F("bridge ready"));
}
void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') { buf[n] = 0; parse(); n = 0; }
    else if (c != '\r' && n < sizeof(buf) - 1) buf[n++] = c;
  }
  if (live && millis() - seen > 2000) { for (int i = 0; i < 16; i++) put(i, 0); live = false; Serial.println(F("watchdog: released")); }
}
