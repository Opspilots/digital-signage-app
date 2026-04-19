import { useState, useCallback, useEffect } from 'react'

export interface DiscoveredDevice {
  id: string
  name: string
  paired?: boolean
}

export interface UseBluetoothReturn {
  isSupported: boolean
  isScanning: boolean
  devices: DiscoveredDevice[]
  error: string | null
  scanForDevices: () => Promise<void>
  clearDevices: () => void
  refreshPaired: () => Promise<void>
}

const SIGNAGE_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BluetoothNavigator = Navigator & { bluetooth?: any }

export function useBluetooth(): UseBluetoothReturn {
  const isSupported =
    typeof navigator !== 'undefined' &&
    'bluetooth' in (navigator as BluetoothNavigator) &&
    (window.isSecureContext || window.location.hostname === 'localhost')

  const [isScanning, setIsScanning] = useState(false)
  const [devices, setDevices] = useState<DiscoveredDevice[]>([])
  const [error, setError] = useState<string | null>(null)

  const addDevice = useCallback((d: DiscoveredDevice) => {
    setDevices((prev) => {
      const idx = prev.findIndex((x) => x.id === d.id)
      if (idx === -1) return [...prev, d]
      const next = [...prev]
      next[idx] = { ...prev[idx], ...d }
      return next
    })
  }, [])

  // Load previously paired devices (Chromium with chrome://flags/#enable-experimental-web-platform-features)
  const refreshPaired = useCallback(async () => {
    if (!isSupported) return
    const bt = (navigator as BluetoothNavigator).bluetooth
    if (typeof bt?.getDevices !== 'function') return
    try {
      const paired = await bt.getDevices()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      paired.forEach((device: any) => {
        addDevice({
          id: device.id,
          name: device.name ?? `Dispositivo (${String(device.id).slice(0, 8)})`,
          paired: true,
        })
      })
    } catch {
      // getDevices unavailable or blocked — silent
    }
  }, [isSupported, addDevice])

  useEffect(() => {
    if (isSupported) refreshPaired()
  }, [isSupported, refreshPaired])

  const scanForDevices = useCallback(async () => {
    if (!isSupported) {
      setError('Web Bluetooth no está disponible en este navegador. Usa Chrome o Edge sobre HTTPS.')
      return
    }

    setIsScanning(true)
    setError(null)

    try {
      const bt = (navigator as BluetoothNavigator).bluetooth
      // Abrimos el selector nativo aceptando cualquier dispositivo visible.
      // Esto es mucho más permisivo que filtrar por UUID de servicio (casi ninguna TV lo anuncia)
      // y deja al usuario elegir su pantalla por nombre.
      const device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SIGNAGE_SERVICE_UUID, 'generic_access', 'device_information'],
      })

      if (device) {
        addDevice({
          id: device.id,
          name: device.name ?? `Dispositivo (${String(device.id).slice(0, 8)})`,
          paired: false,
        })
      }
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          // Usuario cerró el selector — no es un error real
          return
        }
        if (err.name === 'SecurityError') {
          setError('Bluetooth requiere HTTPS o localhost para funcionar.')
          return
        }
        if (err.name === 'NotFoundError') {
          setError('No se encontraron dispositivos. Asegúrate de que la pantalla esté encendida y con Bluetooth activado y cercano.')
          return
        }
        setError(`Error de Bluetooth: ${err.message}`)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Ocurrió un error desconocido al buscar dispositivos.')
      }
    } finally {
      setIsScanning(false)
    }
  }, [isSupported, addDevice])

  const clearDevices = useCallback(() => {
    setDevices([])
    setError(null)
  }, [])

  return { isSupported, isScanning, devices, error, scanForDevices, clearDevices, refreshPaired }
}
