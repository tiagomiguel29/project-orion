import type { SystemData } from "@/components/system-card"

function generateHistory(base: number, variance: number, count: number = 30): number[] {
  const data: number[] = []
  let current = base
  for (let i = 0; i < count; i++) {
    current = Math.max(0, Math.min(100, current + (Math.random() - 0.5) * variance))
    data.push(Math.round(current * 10) / 10)
  }
  return data
}

function generateNetworkHistory(base: number, variance: number, count: number = 30): number[] {
  const data: number[] = []
  let current = base
  for (let i = 0; i < count; i++) {
    current = Math.max(0, current + (Math.random() - 0.5) * variance)
    data.push(Math.round(current * 10) / 10)
  }
  return data
}

export const mockSystems: SystemData[] = [
  {
    id: "srv-01",
    externalId: "srv-01",
    name: "PROD-WEB-01",
    hostname: "10.0.1.10",
    status: "online",
    uptime: "42d 7h 23m",
    cpu: { usage: 34.2, history: generateHistory(34, 15) },
    ram: { usage: 62.8, used: 10.1, total: 16, history: generateHistory(63, 8) },
    disk: { usage: 45.2, used: 231, total: 512 },
    network: {
      upload: 12.4,
      download: 45.8,
      uploadHistory: generateNetworkHistory(12, 8),
      downloadHistory: generateNetworkHistory(46, 15),
    },
    temperature: { current: 52, history: generateHistory(52, 6) },
  },
  {
    id: "srv-02",
    externalId: "srv-02",
    name: "PROD-WEB-02",
    hostname: "10.0.1.11",
    status: "online",
    uptime: "42d 7h 22m",
    cpu: { usage: 28.5, history: generateHistory(28, 12) },
    ram: { usage: 55.2, used: 8.8, total: 16, history: generateHistory(55, 7) },
    disk: { usage: 38.7, used: 198, total: 512 },
    network: {
      upload: 8.2,
      download: 38.1,
      uploadHistory: generateNetworkHistory(8, 5),
      downloadHistory: generateNetworkHistory(38, 12),
    },
    temperature: { current: 48, history: generateHistory(48, 5) },
  },
  {
    id: "srv-03",
    externalId: "srv-03",
    name: "PROD-DB-01",
    hostname: "10.0.2.10",
    status: "warning",
    uptime: "15d 3h 45m",
    cpu: { usage: 78.4, history: generateHistory(78, 10) },
    ram: { usage: 88.1, used: 28.2, total: 32, history: generateHistory(88, 5) },
    disk: { usage: 72.3, used: 740, total: 1024 },
    network: {
      upload: 5.6,
      download: 22.3,
      uploadHistory: generateNetworkHistory(5.6, 3),
      downloadHistory: generateNetworkHistory(22, 8),
    },
    temperature: { current: 72, history: generateHistory(72, 8) },
  },
  {
    id: "srv-04",
    externalId: "srv-04",
    name: "PROD-DB-02",
    hostname: "10.0.2.11",
    status: "online",
    uptime: "89d 14h 12m",
    cpu: { usage: 42.1, history: generateHistory(42, 18) },
    ram: { usage: 71.5, used: 22.9, total: 32, history: generateHistory(71, 6) },
    disk: { usage: 58.4, used: 598, total: 1024 },
    network: {
      upload: 3.2,
      download: 15.7,
      uploadHistory: generateNetworkHistory(3.2, 2),
      downloadHistory: generateNetworkHistory(16, 6),
    },
    temperature: { current: 58, history: generateHistory(58, 4) },
  },
  {
    id: "srv-05",
    externalId: "srv-05",
    name: "PROD-CACHE-01",
    hostname: "10.0.3.10",
    status: "online",
    uptime: "120d 22h 8m",
    cpu: { usage: 15.3, history: generateHistory(15, 8) },
    ram: { usage: 92.4, used: 59.1, total: 64, history: generateHistory(92, 3) },
    disk: { usage: 22.1, used: 45, total: 200 },
    network: {
      upload: 88.4,
      download: 124.2,
      uploadHistory: generateNetworkHistory(88, 30),
      downloadHistory: generateNetworkHistory(124, 40),
    },
    temperature: { current: 44, history: generateHistory(44, 3) },
  },
  {
    id: "srv-06",
    externalId: "srv-06",
    name: "PROD-API-01",
    hostname: "10.0.4.10",
    status: "online",
    uptime: "7d 19h 33m",
    cpu: { usage: 56.7, history: generateHistory(57, 20) },
    ram: { usage: 48.3, used: 7.7, total: 16, history: generateHistory(48, 12) },
    disk: { usage: 31.2, used: 160, total: 512 },
    network: {
      upload: 22.8,
      download: 67.4,
      uploadHistory: generateNetworkHistory(23, 10),
      downloadHistory: generateNetworkHistory(67, 20),
    },
    temperature: { current: 61, history: generateHistory(61, 7) },
  },
  {
    id: "srv-07",
    externalId: "srv-07",
    name: "PROD-API-02",
    hostname: "10.0.4.11",
    status: "offline",
    uptime: "0d 0h 0m",
    cpu: { usage: 0, history: generateHistory(45, 15).map((_, i, arr) => (i > arr.length - 5 ? 0 : arr[i])) },
    ram: { usage: 0, used: 0, total: 16, history: generateHistory(52, 10).map((_, i, arr) => (i > arr.length - 5 ? 0 : arr[i])) },
    disk: { usage: 44.8, used: 229, total: 512 },
    network: {
      upload: 0,
      download: 0,
      uploadHistory: generateNetworkHistory(18, 8).map((_, i, arr) => (i > arr.length - 5 ? 0 : arr[i])),
      downloadHistory: generateNetworkHistory(52, 15).map((_, i, arr) => (i > arr.length - 5 ? 0 : arr[i])),
    },
    temperature: { current: 28, history: generateHistory(55, 5).map((_, i, arr) => (i > arr.length - 5 ? 28 : arr[i])) },
  },
  {
    id: "srv-08",
    externalId: "srv-08",
    name: "STAGING-01",
    hostname: "10.0.10.10",
    status: "online",
    uptime: "3d 11h 5m",
    cpu: { usage: 8.2, history: generateHistory(8, 6) },
    ram: { usage: 22.1, used: 3.5, total: 16, history: generateHistory(22, 8) },
    disk: { usage: 18.5, used: 95, total: 512 },
    network: {
      upload: 1.2,
      download: 4.5,
      uploadHistory: generateNetworkHistory(1.2, 1),
      downloadHistory: generateNetworkHistory(4.5, 3),
    },
    temperature: { current: 38, history: generateHistory(38, 3) },
  },
]
