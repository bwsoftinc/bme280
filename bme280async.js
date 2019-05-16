'use strict';
const bme280 = require('./bme280');

class bme280async extends bme280 {
  constructor(busId, address) {
    super(busId, address);
  }

  _init(mode, s_t, s_p, s_h, f, sb) {
    if((s_t = s_t & 0x07) > 5) throw new Error('Invalid Temperate Oversamping');
    if((s_p = s_p & 0x07) > 5) throw new Error('Invalid Pressure Oversamping');
    if((s_h = s_h & 0x07) > 5) throw new Error('Invalid Humidity Oversamping');
    if((f = f & 0x07) > 4) throw new Error('Invalid IIR Filter');
    sb = sb & 0x07;
    mode = mode & 0x03;

      this.bus.readByte(this.ADDRESS, this.CHIP_ID_ADDR, (err, data) => {
        if(err) return rj(err);
        if(data != this.CHIP_ID) throw new Error('Cannot Find BME280');
        this._reset().then(() => {
          this._getCalibration().then(() => {
            this._setSettings(mode, s_t, s_p, s_h, f, sb).then(() => {
              if(mode != this.FORCED_MODE) return rs();
              this.doForcedRead().then(() => rs()).catch((err) => rj(err));
            }).catch((err) => rj(err));
          }).catch((err) => rj(err));
        }).catch((err) => rj(err));
      });
    });
  }

  _setSettings(mode, s_t, s_p, s_h, f, sb) {
    this.settings.mode = mode;
    this.settings.s_t = s_t;
    this.settings.s_p = s_p;
    this.settings.s_h = s_h;
    this.settings.f = f;
    this.settings.sb = sb;

    return new Promise((rs, rj) => {
      this.bus.writeByte(this.ADDRESS, this.CTRL_HUM_ADDR, s_h, (err) => {
        if(err) return rj(err);
        this.bus.writeByte(this.ADDRESS, this.CTRL_MEAS_ADDR, ((s_t << 5) | (s_p << 2) | mode), (err) => {
          if(err) rj(err);
          this.bus.writeByte(this.ADDRESS, this.CONFIG_ADDR, ((sb << 5) | (f << 2)), (err) => {
            return (err)? rj(err): rs();
          });
        });
      });
    });
  }

  doForcedRead() {
    return new Promise((rs, rj) => {
      this.gotoSleep().then(() => {
        var mode = ((this.settings.s_t << 5) | (this.settings.s_p << 2) | this.FORCED_MODE);
        this.bus.writeByte(this.ADDRESS, this.PWR_CTRL_ADDR, mode, (err) =>  {
          return err? rj(err) : rs();
        });
      }).catch((err) => rj(err));
    });
  }

  gotoSleep() {
    return new Promise((rs, rj) => {
      this._reset().then(() => {
        this._setSettings(0x00,
          this.settings.s_t,
          this.settings.s_p,
          this.settings.s_h,
          this.settings.f,
          this.settings.sb
        ).then(() => rs()).catch((err) => rj(err));
      }).catch((err) => rj(err));
    });
  }

  _reset() {
    return new Promise((rs, rj) => {
      this.bus.writeByte(this.ADDRESS, this.RESET_ADDR, this.SOFT_RESET_CMD, (err) => {
        if(err) return rj(err);
        setTimeout(() => rs(), 2); //datasheet says takes 2ms to perform soft reset
      });
    })
  }

  getData() {
    return new Promise((rs, rj) => {
      this.bus.readI2cBlock(this.ADDRESS, this.DATA_ADDR, 8, Buffer.allocUnsafe(8), (err, len, buffer) => {
        if(err) return rj(err);

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
      });
    });
  }

  _getCalibration() {
    return new Promise((rs, rj) => {
      this.bus.readI2cBlock(this.ADDRESS, this.TEMP_PRESS_CALIB_DATA_ADDR, 26, Buffer.allocUnsafe(26), (err, len, buffer) => {
        if(err) return rj(err);
        this._readTemperatureCalibration(buffer);
        this.bus.readI2cBlock(this.ADDRESS, this.HUMIDITY_CALIB_DATA_ADDR, 7, Buffer.allocUnsafe(7), (err, len, buffer) => {
          if(err) return rj(err);
          this._readHumidityCalibration(buffer);
          return rs();
        });
      });
    });
  }
}

module.exports = bme280async;
