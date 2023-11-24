import { PlatformAccessory, Service, Characteristic, CharacteristicValue } from 'homebridge';
import axios from 'axios';
import { Heatzy } from './platform';

export class MyPlatformAccessory {
  private service: Service;

  constructor(
    private readonly platform: Heatzy,
    private readonly accessory: PlatformAccessory,
    private readonly device: any,
  ) {
    this.platform.log.info('Initializing accessory:', this.device.dev_alias);

    this.service = this.accessory.getService(this.platform.api.hap.Service.Switch) ||
                   this.accessory.addService(this.platform.api.hap.Service.Switch, this.device.dev_alias);

    this.service.getCharacteristic(this.platform.api.hap.Characteristic.On)
      .on('set', (value, callback) => this.setDeviceState(!!value, callback)) // Ensure value is boolean
      .on('get', callback => this.getDeviceState(callback));
  }

  async setDeviceState(value: boolean, callback: Function) {
    if (this.platform.needsAuthentication()) {
      await this.platform.authenticate();
    }
    const url = `https://euapi.gizwits.com/app/control/${this.device.did}`;
    const payload = { attrs: { on: value } };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'X-Gizwits-Application-Id': 'c70a66ff039d41b4a220e198b0fcc8b3',
          'X-Gizwits-User-token': this.platform.getToken(),
        },
      });

      if (response.status === 200) {
        this.platform.log.info('Device state set successfully');
        callback(null); // No error
      } else {
        throw new Error(`Request failed with status code ${response.status}`);
      }
    } catch (error) {
      this.platform.log.error('Failed to set device state:', (error as Error).message);
      if (axios.isAxiosError(error) && error.response) {
        this.platform.log.error('Error response data:', error.response.data);
      }
      callback(error); // Error
    }
  }

  async getDeviceState(callback: Function) {
    // Check for token expiration and authenticate if needed
    if (this.platform.needsAuthentication()) {
      await this.platform.authenticate();
    }

    const url = 'https://euapi.gizwits.com/app/bindings?limit=20&skip=0';

    try {
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'X-Gizwits-User-token': this.platform.getToken(),
          'X-Gizwits-Application-Id': 'c70a66ff039d41b4a220e198b0fcc8b3',
        },
      });

      if (response.status === 200) {
        const deviceData = response.data.devices.find(d => d.did === this.device.did);
        if (deviceData) {
          const isOn = deviceData.is_online; // Assuming 'is_online' indicates the state
          callback(null, isOn); // No error, return state
        } else {
          throw new Error('Device not found');
        }
      } else {
        throw new Error('Non-200 response');
      }
    } catch (error) {
      this.platform.log.error('Failed to get device state:', (error as Error).message);
      callback(error); // Error
    }
  }
}
