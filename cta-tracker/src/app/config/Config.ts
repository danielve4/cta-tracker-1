export class Config {
  public static readonly protocol: string = 'http';
  public static readonly host: string = '10.0.0.112';
  public static readonly port: string = '5000';
  public static readonly baseURL: string = `${Config.protocol}://${Config.host}:${Config.port}`;
}

