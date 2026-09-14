import { tool } from 'ai'
import { z } from 'zod'
import si from 'systeminformation'
import type { ToolModule } from './types'

const gb = (bytes: number): number => Math.round((bytes / 1024 ** 3) * 10) / 10
const percent = (value: number): string => `%${Math.round(value)}`

const systemTools: ToolModule = {
  risks: { sistem_bilgisi: 'read' },
  labels: { sistem_bilgisi: 'Sistem bilgisi' },
  tools: {
    sistem_bilgisi: tool({
      description:
        'Bilgisayarın anlık durumunu verir: işletim sistemi, işlemci kullanımı, bellek, disk doluluğu, pil ve açık kalma süresi.',
      inputSchema: z.object({}),
      execute: async () => {
        const [load, mem, disks, battery, os] = await Promise.all([
          si.currentLoad(),
          si.mem(),
          si.fsSize(),
          si.battery(),
          si.osInfo()
        ])
        const uptime = si.time().uptime

        return {
          isletimSistemi: `${os.distro} ${os.release}`,
          islemciKullanimi: percent(load.currentLoad),
          bellek: {
            toplamGb: gb(mem.total),
            kullanilanGb: gb(mem.active),
            doluluk: percent((mem.active / mem.total) * 100)
          },
          diskler: disks
            .filter((disk) => disk.size > 0)
            .map((disk) => ({
              surucu: disk.mount,
              toplamGb: gb(disk.size),
              bosGb: gb(disk.available),
              doluluk: percent(disk.use)
            })),
          pil: battery.hasBattery
            ? { yuzde: battery.percent, sarjOluyor: battery.isCharging }
            : null,
          acikKalmaSuresi: `${Math.floor(uptime / 3600)} saat ${Math.floor((uptime % 3600) / 60)} dakika`
        }
      }
    })
  }
}

export default systemTools
