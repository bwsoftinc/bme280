'use strict';

class bme280 {
  constructor(busId, address) {
    this.i2c = require('i2c-bus');
    this.bus = this.i2c.openSync(busId || 1);
    this.ADDRESS = address || 0x76;

    this.CHIP_ID_ADDR               = 0xD0;
    this.CHIP_ID                    = 0x60;

    this.RESET_ADDR                 = 0xE0;
    this.SOFT_RESET_CMD             = 0xB6;

    this.FILTER_COEFF_OFF           = 0x00;
    this.FILTER_COEFF_2             = 0x01;
    this.FILTER_COEFF_4             = 0x02;
    this.FILTER_COEFF_8             = 0x03;
    this.FILTER_COEFF_16            = 0x04;

    this.NO_OVERSAMPLING            = 0x00;
    this.OVERSAMPLING_1X            = 0x01;
    this.OVERSAMPLING_2X            = 0x02;
    this.OVERSAMPLING_4X            = 0x03;
    this.OVERSAMPLING_8X            = 0x04;
    this.OVERSAMPLING_16X           = 0x05;

    this.STANDBY_TIME_0_5_MS        = 0x00;
    this.STANDBY_TIME_62_5_MS       = 0x01;
    this.STANDBY_TIME_125_MS        = 0x02;
    this.STANDBY_TIME_250_MS        = 0x03;
    this.STANDBY_TIME_500_MS        = 0x04;
    this.STANDBY_TIME_1000_MS       = 0x05;
    this.STANDBY_TIME_10_MS         = 0x06;
    this.STANDBY_TIME_20_MS         = 0x07;

    this.SLEEP_MODE                 = 0x00;
    this.FORCED_MODE                = 0x01;
    this.NORMAL_MODE                = 0x03;

    this.PWR_CTRL_ADDR              = 0xF4;
    this.CONFIG_ADDR                = 0xF5;
    this.CTRL_MEAS_ADDR             = 0xF4;
    this.CTRL_HUM_ADDR              = 0xF2;

    this.TEMP_PRESS_CALIB_DATA_ADDR = 0x88;
    this.HUMIDITY_CALIB_DATA_ADDR   = 0xE1;
    this.DATA_ADDR                  = 0xF7;

    this.calibration = new function() {
      this.T1 = 0;
      this.T2 = 0;
      this.T3 = 0;
      this.P1 = 0;
      this.P2 = 0;
      this.P3 = 0;
      this.P4 = 0;
      this.P5 = 0;
      this.P6 = 0;
      this.P7 = 0;
      this.P8 = 0;
      this.P9 = 0;
      this.H1 = 0;
      this.H2 = 0;
      this.H3 = 0;
      this.H4 = 0;
      this.H5 = 0;
      this.H6 = 0;
      this.fine = 0;
    };

    this.settings = {
      mode: 0,
      s_t: 0,
      s_p: 0,
      s_h: 0,
      f: 0,
      sb: 0
    };
  }

  getStandby() {
    switch(this.settings.sb) {
      case this.STANDBY_TIME_0_5_MS:
        return 1;
      case this.STANDBY_TIME_10_MS:
        return 10;
      case this.STANDBY_TIME_20_MS:
        return 12;
      case this.STANDBY_TIME_62_5_MS:
        return 63;
      case this.STANDBY_TIME_125_MS:
        return 125;
      case this.STANDBY_TIME_250_MS:
        return 250;
      case this.STANDBY_TIME_500_MS:
        return 500;
      case this.STANDBY_TIME_1000_MS:
        return 1000;
    }
  }

  _init(mode, s_t, s_p, s_h, f, sb) {
    var config = {
        mode : typeof mode === 'undefined'? this.NORMAL_MODE : +mode,
        s_t  : typeof s_t  === 'undefined'? this.OVERSAMPLING_8X : +s_t,
        s_p  : typeof s_p  === 'undefined'? this.OVERSAMPLING_8X : +s_p,
        s_h  : typeof s_h  === 'undefined'? this.OVERSAMPLING_8X : +s_h,
        f    : typeof f    === 'undefined'? this.FILTER_COEFF_OFF : +f,
        sb   : typeof sb   === 'undefined'? this.STANDBY_TIME_125_MS : +sb
      };

    if((config.s_t = config.s_t & 0x07) > 5) throw new Error('Invalid Temperate Oversamping');
    if((config.s_p = config.s_p & 0x07) > 5) throw new Error('Invalid Pressure Oversamping');
    if((config.s_h = config.s_h & 0x07) > 5) throw new Error('Invalid Humidity Oversamping');
    if((config.f = config.f & 0x07) > 4) throw new Error('Invalid IIR Filter');
    config.sb = config.sb & 0x07;
    config.mode = config.mode & 0x03;

    this.settings = config;
  }

  init() { /* abstract */ }

  _calibrateHumidity(hum) {
    var var1 = this.calibration.fine - 76800;
    var var2 = (this.calibration.H4 * 64.0) + ((this.calibration.H5 / 16384) * var1);
    var var3 = hum - var2;
    var var4 = this.calibration.H2 / 65536;
    var var5 = 1 + ((this.calibration.H3 / 67108864) * var1);
    var var6 = 1 + ((this.calibration.H6 / 67108864) * var1 * var5);
    var6 = var3 * var4 * var5 * var6;

    var humidity = var6 * (1 - (this.calibration.H1 * var6 / 524288));

    if (humidity > 100)
      humidity = 100;
    else if (humidity < 0)
      humidity = 0;

    return humidity;
  }

  _calibrateTemperature(temp) {
    var var1 = (temp / 16384) - (this.calibration.T1 / 1024);
    var1 = var1 * this.calibration.T2;

    var var2 = (temp / 131072) - (this.calibration.T1 / 8192);
    var2 = var2 * var2 * this.calibration.T3;

    this.calibration.fine = var1 + var2;
    var temperature = this.calibration.fine / 5120;

    if (temperature < -40)
      temperature = -40;
    else if (temperature > 85)
      temperature = 85;

    return temperature;
  }

  _calibratePressure(press) {
    var var1 = (this.calibration.fine / 2) - 64000;
    var var2 = var1 * var1 * this.calibration.P6 / 32768;
    var2 = var2 + (var1 * this.calibration.P5 * 2);
    var2 = (var2 / 4) + (this.calibration.P4 * 65536);
    var var3 = this.calibration.P3 * var1 * var1 / 524288;
    var1 = (var3 + (this.calibration.P2 * var1)) / 524288;
    var1 = (1.0 + (var1 / 32768.0)) * this.calibration.P1;

    var pressure = 0;
    if (var1) {
      pressure = 1048576 - press;
      pressure = (pressure - (var2 / 4096)) * 6250 / var1;
      var1 = this.calibration.P9 * pressure * pressure / 2147483648;
      var2 = pressure * this.calibration.P8 / 32768;
      pressure = pressure + ((var1 + var2 + this.calibration.P7) / 16);

      if (pressure < 30000)
        pressure = 30000;
      else if (pressure > 110000)
        pressure = 110000;
    }
    else
      pressure = 30000;

    return pressure;
  }

  _temperatureCalibration(buffer) {
      this.calibration.T1 = this._uint16(buffer[1], buffer[0]);
      this.calibration.T2 = this._int16(buffer[3], buffer[2]);
      this.calibration.T3 = this._int16(buffer[5], buffer[4]);
      this.calibration.P1 = this._uint16(buffer[7], buffer[6]);
      this.calibration.P2 = this._int16(buffer[9], buffer[8]);
      this.calibration.P3 = this._int16(buffer[11], buffer[10]);
      this.calibration.P4 = this._int16(buffer[13], buffer[12]);
      this.calibration.P5 = this._int16(buffer[15], buffer[14]);
      this.calibration.P6 = this._int16(buffer[17], buffer[16]);
      this.calibration.P7 = this._int16(buffer[19], buffer[18]);
      this.calibration.P8 = this._int16(buffer[21], buffer[20]);
      this.calibration.P9 = this._int16(buffer[23], buffer[22]);
      this.calibration.H1 = buffer[25];
  }

  _humidityCalibration(buffer) {
      this.calibration.H2 = this._int16(buffer[1], buffer[0]);
      this.calibration.H3 = buffer[2];
      this.calibration.H4 = (buffer[3] << 4) | (buffer[4] & 0x0F);
      this.calibration.H5 = (buffer[5] << 4) | (buffer[4] >> 4);
      this.calibration.H6 = this._int8(buffer[6]);
  }

  _int8(val) {
    val &= 0x0F;
    return val > 127 ? (val - 256) : val;
  }

  _int16(msb, lsb) {
    lsb &= 0x0F
    var val = (msb << 8) | lsb;
    return val > 32767 ? (val - 65536) : val;
  }

  _uint16(msb, lsb) {
    lsb &= 0x0F;
    return (msb << 8) | lsb;
  }
}

module.exports = bme280;
