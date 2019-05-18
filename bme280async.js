'use strict';
const bme280 = require('./bme280');

class bme280async extends bme280 {
  constructor(busId, address) {
    super(busId, address);
  }

  readByte(addr) {
    return new Promise((resolve, reject) =>
      this.bus.readByte(
        this.ADDRESS,
        addr,
        (err, data) => err? reject(err) : resolve(data)
      );
    );
  }

  writeByte(cmd, byte) {
    return new Promise((resolve, reject) =>
      this.bus.writeByte(
        this.ADDRESS,
        cmd,
        byte,
        (err) => err? reject(err) : resolve()
      );
    );
  }

  async init(mode, s_t, s_p, s_h, f, sb) {
    this._init(mode, s_t, s_p, s_h, f, sb);
    var data = await this.readByte(this.CHIP_ID_ADDR);
    if(data != this.CHIP_ID) throw new Error('Cannot Find BME280');
    await this._reset();
    await this._getCalibration();
    await this._setSettings();
  }

  async _setSettings() {
    await Promise.all([
      this.writeByte(this.CTRL_HUM_ADDR, this.settings.s_h),
      this.writeByte(this.CTRL_MEAS_ADDR, ((this.settings.s_t << 5) | (this.settings.s_p << 2) | this.settings.mode)),
      this.writeByte(this.CONFIG_ADDR, ((this.settings.sb << 5) | (this.settings.f << 2)))
    ]);
  }

  async doForcedRead() {
    await this.gotoSleep();
    this.settings.mode = this.FORCED_MODE));
    await this._setSettings();
  }

  async gotoSleep() {
    await this._reset();
    this.settings.mode = this.SLEEP_MODE;
    await this._setSettings();
  }

  async _reset() {
    await this.writeByte(this.RESET_ADDR, this.SOFT_RESET_CMD);
    await delay(2);
  }

  async getData() {
    var buffer = await this.readBytes(this.DATA_ADDR, 8);

    var temperature = (buffer[3] << 12) | (buffer[4] << 4) | (buffer[5] >>> 4);
    temperature = this._calibrateTemperature(temperature);

    var pressure = (buffer[0] << 12) | (buffer[1] << 4) | (buffer[2] >>> 4);
    pressure = this._calibratePressure(pressure);

    var humidity = (buffer[6] << 8) | buffer[7];
    humidity = this._calibrateHumidity(humidity);

    return rs({
      temperature: (temperature * 9 / 5) + 32,
      pressure: pressure * 0.0002952998751,
      humidity: humidity
    });
  }

  readBytes(addr, length) {
    return new Promise((resolve, reject) =>
      this.bus.readI2cBlock(
        this.ADDRESS,
        addr,
        length,
        Buffer.allocUnsafe(length),
        (err, len, buffer) => err? reject(err) : resolve(buffer)
      );
    );
  }

  async _getCalibration() {
    this._tremperatureCalibration(await this.readBytes(this.TEMP_PRESS_CALIB_DATA_ADDR, 26));
    this._humidityCalibration(await this.readBytes(this.HUMIDITY_CALIB_DATA_ADDR, 7));
  }
}

module.exports = bme280async;
