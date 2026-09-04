import { formatTurkeyPhoneInput, parseTurkeyPhone, isTurkeyPhoneComplete } from "./phoneMask";

describe("formatTurkeyPhoneInput", () => {
  it("boş girişte boş döner", () => {
    expect(formatTurkeyPhoneInput("")).toBe("");
  });

  it("rakamları yazdıkça gruplar", () => {
    expect(formatTurkeyPhoneInput("5")).toBe("+90 5");
    expect(formatTurkeyPhoneInput("505")).toBe("+90 505");
    expect(formatTurkeyPhoneInput("505123")).toBe("+90 505 123");
    expect(formatTurkeyPhoneInput("5051234")).toBe("+90 505 123 4");
    expect(formatTurkeyPhoneInput("5051234567")).toBe("+90 505 123 45 67");
  });

  it("fazla haneleri kırpar (10 hane ulusal)", () => {
    expect(formatTurkeyPhoneInput("50512345678")).toBe("+90 505 123 45 67");
  });

  it("baştaki 0 ve ulke kodunu sıyırır", () => {
    expect(formatTurkeyPhoneInput("05051234567")).toBe("+90 505 123 45 67");
    expect(formatTurkeyPhoneInput("905051234567")).toBe("+90 505 123 45 67");
    expect(formatTurkeyPhoneInput("+90 505 123 45 67")).toBe("+90 505 123 45 67");
  });

  it("5 dışında başlayan ilk haneleri reddeder", () => {
    expect(formatTurkeyPhoneInput("4")).toBe("");
    expect(formatTurkeyPhoneInput("3051234567")).toBe("+90 512 345 67");
  });

  it("harf ve işaretleri ayıklar", () => {
    expect(formatTurkeyPhoneInput("abc5def0g5h1i2j3k4l5m6n7o8")).toBe("+90 505 123 45 67");
  });
});

describe("parseTurkeyPhone / isTurkeyPhoneComplete", () => {
  it("tam numarayı 90+9 hane olarak çözer", () => {
    expect(parseTurkeyPhone("+90 505 123 45 67")).toBe("905051234567");
    expect(isTurkeyPhoneComplete("+90 505 123 45 67")).toBe(true);
  });

  it("eksik numarada tamamlanmamış sayar", () => {
    expect(isTurkeyPhoneComplete("+90 505 123")).toBe(false);
    expect(parseTurkeyPhone("+90 505 123")).toBe("");
  });

  it("5 dışında biten ulusal kodda geçersiz", () => {
    expect(parseTurkeyPhone("+90 305 123 45 67")).toBe("");
  });
});
