import { useState, useCallback } from 'react'

export interface DiscoveredDevice {
  id: string
  name: string
}

export interface UseBluetoothReturn {
  isSupported: boolean
  isScanning: boolean
  devices: DiscoveredDevice[]
  error: string | null
  scanForDevices: () => Promise<void>
  clearDevices: () => void
}

const SIGNAGE_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0'

export function useBluetooth(): UseBluetoothReturn {
  const isSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator

  const [isScanning, setIsScanning] = useState(false)
  const [devices, setDevices] = useState<DiscoveredDevice[]>([])
  const [error, setError] = useState<string | null>(null)

  const scanForDevices = useCallback(async () => {
    if (!isSupported) {
      setError('Web Bluetooth is not supported in this browser or context.')
      return
    }

    setIsScanning(true)
    setError(null)

    try {
      // First try to find devices advertising our custom signage service
      let device: BluetoothDevice | null = null

      try {
        device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [SIGNAGE_SERVICE_UUID] }],
        })
      } catch (filteredErr) {
        // If no signage devices found or user cancelled during filtered scan,
        // fall back to acceptAllDevices so the user can pick any visible device
        if (
          filteredErr instanceof DOMException &&
          filteredErr.name === 'NotFoundError'
        ) {
          device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
          })
        } else {
          // Re-throw cancellations and other errors
          throw filteredErr
        }
      }

      if (device) {
        const discovered: DiscoveredDevice = {
          id: device.id,
          name: device.name ?? `Unknown Device (${device.id.slice(0, 8)})`,
        }

        setDevices((prev) => {
          // Deduplicate by id
          const exists = prev.some((d) => d.id === discovered.id)
          return exists ? prev : [...prev, discovered]
        })
      }
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          // User dismissed the picker — not an error worth showing
          return
        }
        if (err.name === 'SecurityError') {
          setError(
            'Bluetooth access requires a secure context (HTTPS or localhost).'
          )
          return
        }
        setError(`Bluetooth error: ${err.message}`)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unknown error occurred during Bluetooth scanning.')
      }
    } finally {
      setIsScanning(false)
    }
  }, [isSupported])

  const clearDevices = useCallback(() => {
    setDevices([])
    setError(null)
  }, [])

  return { isSupported, isScanning, devices, error, scanForDevices, clearDevices }
}
