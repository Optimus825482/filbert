/**
 * Web Serial API için gereken en küçük tip tanımları.
 *
 * TypeScript'in `lib.dom` çıktısı Web Serial'i (henüz) içermediği için Nimbot
 * B1'in USB seri arayüzüne bağlanmak üzere burada tanımlanır. Yalnızca
 * kullandığımız yüzey yer alır; geri kalan davranışı Chrome/Edge sağlar.
 *
 * Not: `navigator.serial` yalnızca güvenli bağlamda (https veya localhost)
 * bulunur; çağrı yerlerinde varlığı ayrıca kontrol edilir.
 */

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: "none" | "even" | "odd";
  bufferSize?: number;
  flowControl?: "none" | "hardware";
}

interface SerialPortRequestOptions {
  filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
}

interface SerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(secenekler: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
  forget(): Promise<void>;
}

interface Serial extends EventTarget {
  getPorts(): Promise<SerialPort[]>;
  requestPort(secenekler?: SerialPortRequestOptions): Promise<SerialPort>;
}

interface Navigator {
  readonly serial: Serial;
}