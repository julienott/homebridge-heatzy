import axios from 'axios';
import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
import { MyPlatformAccessory } from './platformAccessory';

export class Heatzy implements DynamicPlatformPlugin {
  private readonly accessories: PlatformAccessory[] = [];
  private token: string | null = null;
  private tokenExpireAt: number | null = null;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.info('Heatzy Plugin Finished Launching');
    this.api.on('didFinishLaunching', () => this.authenticate());
  }

  async authenticate() {
    try {
      const response = await axios.post('https://euapi.gizwits.com/app/login', {
        username: this.config.username,
        password: this.config.password,
        lang: 'en',
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Gizwits-Application-Id': 'c70a66ff039d41b4a220e198b0fcc8b3',
        },
      });

      const { token } = response.data;
      this.token = token;
      this.tokenExpireAt = new Date().getTime() + 3600000; // 1 hour token validity
      this.fetchDevices();
    } catch (error) {
      this.log.error('Error authenticating:', (error as Error).message);
    }
  }

  async fetchDevices() {
    if (!this.token) {
      this.log.error('Token not available, unable to fetch devices');
      return;
    }

    try {
      const response = await axios.get('https://euapi.gizwits.com/app/bindings?limit=20&skip=0', {
        headers: {
          'Accept': 'application/json',
          'X-Gizwits-User-token': this.token,
          'X-Gizwits-Application-Id': 'c70a66ff039d41b4a220e198b0fcc8b3',
        },
      });

      const devices = response.data.devices;
      this.log.info('Fetched devices:', devices.length);
      devices.forEach(device => this.addAccessory(device));
    } catch (error) {
      this.log.error('Error fetching devices:', (error as Error).message);
    }
  }

  addAccessory(device: any) {
    // Get selected modes from config
    const selectedModes = this.config.modes || [];

    selectedModes.forEach(mode => {
      // Skip accessory creation if the mode is not set
      if (!mode) {
        return;
      }

      const uniqueId = device.did + '-' + mode; // Unique ID for each mode
      const uuid = this.api.hap.uuid.generate(uniqueId);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        existingAccessory.context.device = device;
        existingAccessory.context.mode = mode; // Store the mode in the context
        new MyPlatformAccessory(this, existingAccessory, device, mode);
      } else {
        const displayName = `${device.dev_alias}-${mode}`;
        this.log.info('Adding new accessory:', displayName);

        const accessory = new this.api.platformAccessory(displayName, uuid);
        accessory.context.device = device;
        accessory.context.mode = mode; // Store the mode in the context
        new MyPlatformAccessory(this, accessory, device, mode);
        this.api.registerPlatformAccessories('homebridge-heatzy', 'Heatzy', [accessory]);
        this.accessories.push(accessory);
      }
    });
  }


  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Configuring accessory:', accessory.displayName);
    this.accessories.push(accessory);
  }

  getToken(): string | null {
    return this.token;
  }

  needsAuthentication(): boolean {
    return !this.token || !this.tokenExpireAt || this.tokenExpireAt < Date.now();
  }
}
