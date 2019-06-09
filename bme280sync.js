'use strict';
const bme280 = require('./bme280');
const sleep = (ms) => require("child_process")
  .spawnSync(process.argv[0], ['-e', 'setTimeout(function(){},' + ms + ')']);

class bme280sync extends bme280 {
  constructor(busId, address) {
    super(busId, address);
  }

  init(mode, s_t, s_p, s_h, f, sb) {
    this._init(mode, s_t, s_p, s_h, f, sb);
    var data = this.bus.readByteSync(this.ADDRESS, this.CHIP_ID_ADDR);
    if(data != this.CHIP_ID) throw new Error('Cannot Find BME280');
    this._reset();
    this._getCalibration();
    this._setSettings();
  }

  _setSettings() {
    this.bus.writeByteSync(this.ADDRESS, this.CTRL_HUM_ADDR, this.settings.s_h);
    this.bus.writeByteSync(this.ADDRESS, this.CTRL_MEAS_ADDR, ((this.settings.s_t << 5) | (this.settings.s_p << 2) | this.settings.mode));
    this.bus.writeByteSync(this.ADDRESS, this.CONFIG_ADDR, ((this.settings.sb << 5) | (this.settings.f << 2)));
  }

  doForcedRead() {
    this.settings.mode = this.FORCED_MODE;
    this._setSettings();
  }

  gotoSleep() {
    this._reset();
    this.settings.mode = this.SLEEP_MODE;
    this._setSettings();
  }

  _reset() {
    this.bus.writeByteSync(this.ADDRESS, this.RESET_ADDR, this.SOFT_RESET_CMD);
    sleep(2); //datasheet says takes 2ms to perform soft reset
  }

  getData() {
    var buffer = Buffer.allocUnsafe(8);
    this.bus.readI2cBlockSync(this.ADDRESS, this.DATA_ADDR, 8, buffer);
    return this.parseData(buffer);
  }

  _getCalibration() {
    var buffer = Buffer.allocUnsafe(26)
    this.bus.readI2cBlockSync(this.ADDRESS, this.TEMP_PRESS_CALIB_DATA_ADDR, 26, buffer);
    this._temperatureCalibration(buffer);

    buffer = Buffer.allocUnsafe(7);
    this.bus.readI2cBlockSync(this.ADDRESS, this.HUMIDITY_CALIB_DATA_ADDR, 7, buffer);
    this._humidityCalibration(buffer);
  }
}

module.exports = bme280sync;
