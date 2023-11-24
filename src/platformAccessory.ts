import { PlatformAccessory, Service, Characteristic, CharacteristicValue } from 'homebridge';
import axios from 'axios';
import { Heatzy } from './platform';

export class MyPlatformAccessory {
  private service: Service;
  private modeMapping = {
    'Confort': 0,
    'Eco': 4,
    'EcoPlus': 5,
    'Sleep': 1,
    'Antifreeze': 2,
  };

  private off_mode = 3;
  private mode: string; // Add mode as a class property

  constructor(
    private readonly platform: Heatzy,
    private readonly accessory: PlatformAccessory,
    private readonly device: any,
    mode: string, // Constructor parameter
  ) {
    this.mode = mode; // Store mode
    this.platform.log.info('Initializing accessory:', accessory.displayName);

    this.service = this.accessory.getService(this.platform.api.hap.Service.Switch) ||
                   this.accessory.addService(this.platform.api.hap.Service.Switch, accessory.displayName);

    this.service.getCharacteristic(this.platform.api.hap.Characteristic.On)
      .on('set', (value, callback) => this.setDeviceState(!!value, callback))
      .on('get', callback => this.getDeviceState(callback));
  }

  async setDeviceState(value: boolean, callback: Function) {
    if (this.platform.needsAuthentication()) {
      await this.platform.authenticate();
    }

    const modeToSet = value ? this.modeMapping[this.mode] : this.off_mode;
    const url = `https://euapi.gizwits.com/app/control/${this.device.did}`;
    const payload = { attrs: { mode: modeToSet } };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'X-Gizwits-Application-Id': 'c70a66ff039d41b4a220e198b0fcc8b3',
          'X-Gizwits-User-token': this.platform.getToken(),
        },
      });

      if (response.status === 200) {
        this.platform.log.info('Device state set successfully');
        callback(null);
      } else {
        throw new Error(`Request failed with status code ${response.status}`);
      }
    } catch (error) {
      this.platform.log.error('Failed to set device state:', (error as Error).message);
      callback(error);
    }
  }

  async getDeviceState(callback: Function) {
    if (this.platform.needsAuthentication()) {
      await this.platform.authenticate();
    }

    const url = `https://euapi.gizwits.com/app/devdata/${this.device.did}/latest`;

    try {
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'X-Gizwits-User-token': this.platform.getToken(),
          'X-Gizwits-Application-Id': 'c70a66ff039d41b4a220e198b0fcc8b3',
        },
      });

      if (response.status === 200 && response.data && response.data.attr) {
        const currentMode = response.data.attr.mode;
        const expectedModeValue = this.modeMapping[this.mode];
        const isOn = currentMode === expectedModeValue;
        callback(null, isOn);
      } else {
        this.platform.log.error('Unexpected response:', response.status, response.statusText, response.data);
        throw new Error('Non-200 response or invalid data format');
      }
    } catch (error) {
      this.platform.log.error('Failed to get device state:', (error as Error).message);
      if (axios.isAxiosError(error) && error.response) {
        this.platform.log.error('Error response data:', error.response.data);
      }
      callback(error);
    }
  }



}
