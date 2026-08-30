import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Navigation, Route, Search, Users, Loader2, X, Eye, EyeOff, CheckCircle2, AlertCircle, Circle, LocateFixed, Download, FileText } from "lucide-react";
import { MapView } from "@/components/Map";
import { toast } from "sonner";

// Types
interface DocProgress {
  total: number;
  done: number;
}

interface GeocodedCustomer {
  id: number;
  companyName: string;
  contactName: string | null;
  address: string;
  status: string;
  position: google.maps.LatLng;
  docProgress: DocProgress;
}

type DocFilter = "all" | "complete" | "partial" | "none";

// 案件相談シートのお客様
interface ConsultationCustomer {
  id: number;
  name: string;
  address: string;
  status: string | null;
  postedAt: string | null;
  userName: string | null;
  position: google.maps.LatLng;
}

// 案件相談シートのテキストから住所と氏名をパース
function parseConsultationAddress(text: string | null): { name: string; address: string } | null {
  if (!text) return null;
  if (!text.includes("案件相談シート") && !text.includes("《案件相談シート》")) return null;
  
  const extractField = (label: string): string => {
    const bracketRegex = new RegExp(`[・]?${label}[【\\[]([^】\\]]*?)[】\\]]`, "s");
    const bracketMatch = text.match(bracketRegex);
    if (bracketMatch) return bracketMatch[1].trim();
    const inBracketRegex = new RegExp(`【${label}[\\s　]+(.+?)】`);
    const inBracketMatch = text.match(inBracketRegex);
    if (inBracketMatch) return inBracketMatch[1].trim();
    return "";
  };
  
  const name = extractField("氏名");
  const address = extractField("住所");
  if (!address) return null;
  return { name, address };
}

// Area extraction helpers
const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県"
];

function extractPrefecture(address: string): string {
  for (const pref of PREFECTURES) {
    if (address.includes(pref)) return pref;
  }
  // Handle short forms (東京, 大阪, 京都, 北海道)
  if (address.startsWith("東京")) return "東京都";
  if (address.startsWith("大阪")) return "大阪府";
  if (address.startsWith("京都")) return "京都府";
  if (address.startsWith("北海道")) return "北海道";
  return "不明";
}

function extractCity(address: string): string {
  // Remove prefecture first
  let rest = address;
  for (const pref of PREFECTURES) {
    if (rest.includes(pref)) {
      rest = rest.substring(rest.indexOf(pref) + pref.length);
      break;
    }
  }
  // Also handle short forms
  if (rest === address) {
    if (address.startsWith("東京")) rest = address.substring(2);
    else if (address.startsWith("大阪")) rest = address.substring(2);
    else if (address.startsWith("京都")) rest = address.substring(2);
    else if (address.startsWith("北海道")) rest = address.substring(3);
  }
  // Match city/ward/town/village
  const cityMatch = rest.match(/^(.+?[市区町村郡])/);
  if (cityMatch) return cityMatch[1];
  return "不明";
}

// Doc progress helpers
function getDocStatus(progress: DocProgress): "complete" | "partial" | "none" {
  if (progress.done >= progress.total) return "complete";
  if (progress.done > 0) return "partial";
  return "none";
}

function getDocPinColor(progress: DocProgress): string {
  const status = getDocStatus(progress);
  switch (status) {
    case "complete": return "#22c55e"; // green
    case "partial": return "#eab308";  // yellow
    case "none": return "#ef4444";     // red
  }
}

function getDocLabel(progress: DocProgress): string {
  const status = getDocStatus(progress);
  switch (status) {
    case "complete": return "書類完了";
    case "partial": return `書類 ${progress.done}/${progress.total}`;
    case "none": return "書類未着手";
  }
}

export default function MapPage() {
  const { data: mapCustomers, isLoading } = trpc.customer.forMap.useQuery();
  const { data: consultationMsgs } = trpc.slack.consultationAddresses.useQuery();
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [geocodedCustomers, setGeocodedCustomers] = useState<GeocodedCustomer[]>([]);
  const [geocodingProgress, setGeocodingProgress] = useState<{ done: number; total: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchText, setSearchText] = useState("");
  const [showPins, setShowPins] = useState(true);
  const [docFilter, setDocFilter] = useState<DocFilter>("all");
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const geocodingDoneRef = useRef(false);
  const clusterMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [selectedPrefecture, setSelectedPrefecture] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [showConsultationPins, setShowConsultationPins] = useState(true);
  const [consultationCustomers, setConsultationCustomers] = useState<ConsultationCustomer[]>([]);
  const consultationMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const consultationGeocodedRef = useRef(false);


  const customersWithAddress = useMemo(() => {
    return mapCustomers?.filter((c) => c.address && c.address.trim()) || [];
  }, [mapCustomers]);

  // Extract available prefectures and cities from geocoded customers
  const availablePrefectures = useMemo(() => {
    const prefSet = new Set<string>();
    geocodedCustomers.forEach((c) => {
      const pref = extractPrefecture(c.address);
      if (pref !== "不明") prefSet.add(pref);
    });
    return Array.from(prefSet).sort();
  }, [geocodedCustomers]);

  const availableCities = useMemo(() => {
    const citySet = new Set<string>();
    geocodedCustomers.forEach((c) => {
      if (selectedPrefecture !== "all" && extractPrefecture(c.address) !== selectedPrefecture) return;
      const city = extractCity(c.address);
      if (city !== "不明") citySet.add(city);
    });
    return Array.from(citySet).sort();
  }, [geocodedCustomers, selectedPrefecture]);

  // Reset city when prefecture changes
  useEffect(() => {
    setSelectedCity("all");
  }, [selectedPrefecture]);

  const filteredCustomers = useMemo(() => {
    let list = geocodedCustomers;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (c) =>
          c.companyName.toLowerCase().includes(q) ||
          (c.contactName && c.contactName.toLowerCase().includes(q)) ||
          c.address.toLowerCase().includes(q)
      );
    }
    if (docFilter !== "all") {
      list = list.filter((c) => getDocStatus(c.docProgress) === docFilter);
    }
    if (selectedPrefecture !== "all") {
      list = list.filter((c) => extractPrefecture(c.address) === selectedPrefecture);
    }
    if (selectedCity !== "all") {
      list = list.filter((c) => extractCity(c.address) === selectedCity);
    }
    return list;
  }, [geocodedCustomers, searchText, docFilter, selectedPrefecture, selectedCity]);

  // Geocode all customers when map is ready
  const geocodeAllCustomers = useCallback(async (map: google.maps.Map) => {
    if (geocodingDoneRef.current || customersWithAddress.length === 0) return;
    geocodingDoneRef.current = true;

    const geocoder = new google.maps.Geocoder();
    const results: GeocodedCustomer[] = [];
    const bounds = new google.maps.LatLngBounds();
    const total = customersWithAddress.length;
    setGeocodingProgress({ done: 0, total });

    for (let i = 0; i < customersWithAddress.length; i++) {
      const customer = customersWithAddress[i];
      if (!customer.address) continue;

      const docProgress = (customer as any).docProgress || { total: 11, done: 0 };

      // Use stored lat/lng if available
      if (customer.latitude && customer.longitude) {
        const lat = parseFloat(String(customer.latitude));
        const lng = parseFloat(String(customer.longitude));
        if (!isNaN(lat) && !isNaN(lng)) {
          const position = new google.maps.LatLng(lat, lng);
          results.push({
            id: customer.id,
            companyName: customer.companyName,
            contactName: customer.contactName,
            address: customer.address,
            status: customer.status,
            position,
            docProgress,
          });
          bounds.extend(position);
          setGeocodingProgress({ done: i + 1, total });
          continue;
        }
      }

      try {
        const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode({ address: customer.address! }, (res, status) => {
            if (status === "OK" && res) resolve(res);
            else reject(status);
          });
        });

        const position = result[0].geometry.location;
        results.push({
          id: customer.id,
          companyName: customer.companyName,
          contactName: customer.contactName,
          address: customer.address,
          status: customer.status,
          position,
          docProgress,
        });
        bounds.extend(position);
      } catch {
        // Skip invalid addresses
      }

      setGeocodingProgress({ done: i + 1, total });
      if (i < customersWithAddress.length - 1) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    setGeocodedCustomers(results);
    setGeocodingProgress(null);
    placeMarkers(map, results);

    if (results.length > 0) {
      map.fitBounds(bounds);
      if (results.length === 1) map.setZoom(15);
    }

    toast.success(`${results.length}件のお客様をマップに表示しました`);
  }, [customersWithAddress]);

  // 案件相談シートのお客様をジオコーディング
  const geocodeConsultationCustomers = useCallback(async (map: google.maps.Map) => {
    if (consultationGeocodedRef.current || !consultationMsgs || consultationMsgs.length === 0) return;
    consultationGeocodedRef.current = true;

    const geocoder = new google.maps.Geocoder();
    const results: ConsultationCustomer[] = [];

    for (const msg of consultationMsgs) {
      const parsed = parseConsultationAddress(msg.messageText);
      if (!parsed || !parsed.address) continue;

      try {
        const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode({ address: parsed.address }, (res, status) => {
            if (status === "OK" && res) resolve(res);
            else reject(status);
          });
        });

        results.push({
          id: msg.id,
          name: parsed.name || msg.userName || "不明",
          address: parsed.address,
          status: msg.consultationStatus,
          postedAt: msg.postedAt ? String(msg.postedAt) : null,
          userName: msg.userName,
          position: result[0].geometry.location,
        });
      } catch {
        // Skip invalid addresses
      }

      await new Promise((r) => setTimeout(r, 80));
    }

    setConsultationCustomers(results);
    placeConsultationMarkers(map, results);
    if (results.length > 0) {
      toast.success(`案件相談シートから${results.length}件のお客様をマップに追加しました`);
    }
  }, [consultationMsgs]);

  // 案件相談シートのマーカーを作成
  const createConsultationMarkerContent = useCallback((customer: ConsultationCustomer) => {
    const color = customer.status === "done" ? "#22c55e" : "#8b5cf6"; // 紫色（未対応）/ 緑（対応済）
    const el = document.createElement("div");
    el.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      background: white;
      border: 2.5px solid ${color};
      border-radius: 20px;
      padding: 4px 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      cursor: pointer;
      transition: transform 0.2s;
    `;
    el.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span style="font-size:11px;font-weight:600;color:#1f2937;white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis;">
        ${customer.name}
      </span>
    `;
    return el;
  }, []);

  // 案件相談シートのマーカーを配置
  const placeConsultationMarkers = useCallback((map: google.maps.Map, customers: ConsultationCustomer[]) => {
    consultationMarkersRef.current.forEach((m) => (m.map = null));
    consultationMarkersRef.current = [];

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    customers.forEach((customer) => {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: customer.position,
        title: customer.name,
        content: createConsultationMarkerContent(customer),
      });

      marker.addListener("gmp-click", () => {
        const statusColor = customer.status === "done" ? "#22c55e" : "#8b5cf6";
        const statusLabel = customer.status === "done" ? "対応済み" : "未対応";
        const dateStr = customer.postedAt ? new Date(customer.postedAt).toLocaleDateString("ja-JP") : "";
        infoWindowRef.current!.setContent(`
          <div style="padding:12px;max-width:280px;font-family:system-ui,-apple-system,sans-serif">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
              <span style="background:${statusColor};color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${statusLabel}</span>
              <span style="font-size:11px;color:#6b7280">${dateStr}</span>
            </div>
            <h3 style="font-weight:700;font-size:15px;margin:0 0 4px;color:#111827">${customer.name}</h3>
            <p style="font-size:12px;color:#6b7280;margin:4px 0">📍 ${customer.address}</p>
            ${customer.userName ? `<p style="font-size:11px;color:#9ca3af;margin:4px 0">投稿者: ${customer.userName}</p>` : ""}
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb">
              <span style="font-size:11px;color:#8b5cf6;font-weight:600">📋 案件相談シート</span>
            </div>
          </div>
        `);
        infoWindowRef.current!.open(map, marker);
      });

      consultationMarkersRef.current.push(marker);
    });
  }, [createConsultationMarkerContent]);

  // Create marker content with doc progress color
  const createMarkerContent = useCallback((customer: GeocodedCustomer, isHighlighted: boolean = false) => {
    const color = getDocPinColor(customer.docProgress);
    const docStatus = getDocStatus(customer.docProgress);
    const el = document.createElement("div");
    el.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      background: ${isHighlighted ? color : "white"};
      border: 2.5px solid ${color};
      border-radius: 20px;
      padding: 4px 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      transform: ${isHighlighted ? "scale(1.15)" : "scale(1)"};
      z-index: ${isHighlighted ? "100" : "1"};
    `;

    // Icon based on doc status
    let icon = "";
    if (docStatus === "complete") {
      icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isHighlighted ? "white" : color}" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (docStatus === "partial") {
      icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isHighlighted ? "white" : color}" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    } else {
      icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isHighlighted ? "white" : color}" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    }

    el.innerHTML = `
      ${icon}
      <span style="font-size:11px;font-weight:600;color:${isHighlighted ? "white" : "#1f2937"};white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis;">
        ${customer.companyName}
      </span>
    `;
    return el;
  }, []);

  // Create cluster marker
  const createClusterContent = useCallback((count: number, customers: GeocodedCustomer[]) => {
    // Determine cluster color based on majority doc status
    const statusCounts = { complete: 0, partial: 0, none: 0 };
    customers.forEach((c) => {
      statusCounts[getDocStatus(c.docProgress)]++;
    });
    let clusterColor = "#6366f1"; // default indigo
    if (statusCounts.complete >= statusCounts.partial && statusCounts.complete >= statusCounts.none) {
      clusterColor = "#22c55e";
    } else if (statusCounts.partial >= statusCounts.none) {
      clusterColor = "#eab308";
    } else {
      clusterColor = "#ef4444";
    }

    const el = document.createElement("div");
    el.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: ${clusterColor};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 3px 12px rgba(0,0,0,0.25);
      cursor: pointer;
      transition: transform 0.2s;
      font-size: 14px;
      font-weight: 700;
      color: white;
    `;
    el.textContent = String(count);
    el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.2)"; });
    el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
    return el;
  }, []);

  // Simple grid-based clustering
  const clusterCustomers = useCallback((customers: GeocodedCustomer[], map: google.maps.Map) => {
    const zoom = map.getZoom() || 10;
    // Adjust grid size based on zoom level
    const gridSize = zoom >= 15 ? 0 : zoom >= 12 ? 0.005 : zoom >= 10 ? 0.02 : 0.05;

    if (gridSize === 0) {
      // No clustering at high zoom
      return { singles: customers, clusters: [] as { center: google.maps.LatLng; customers: GeocodedCustomer[] }[] };
    }

    const grid = new Map<string, GeocodedCustomer[]>();
    customers.forEach((c) => {
      const lat = Math.floor(c.position.lat() / gridSize) * gridSize;
      const lng = Math.floor(c.position.lng() / gridSize) * gridSize;
      const key = `${lat},${lng}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(c);
    });

    const singles: GeocodedCustomer[] = [];
    const clusters: { center: google.maps.LatLng; customers: GeocodedCustomer[] }[] = [];

    grid.forEach((group) => {
      if (group.length === 1) {
        singles.push(group[0]);
      } else {
        // Calculate center
        let totalLat = 0, totalLng = 0;
        group.forEach((c) => {
          totalLat += c.position.lat();
          totalLng += c.position.lng();
        });
        clusters.push({
          center: new google.maps.LatLng(totalLat / group.length, totalLng / group.length),
          customers: group,
        });
      }
    });

    return { singles, clusters };
  }, []);

  // Place markers with clustering
  const placeMarkers = useCallback((map: google.maps.Map, customers: GeocodedCustomer[]) => {
    // Clear existing markers
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];
    clusterMarkersRef.current.forEach((m) => (m.map = null));
    clusterMarkersRef.current = [];

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    const { singles, clusters } = clusterCustomers(customers, map);

    // Place individual markers
    singles.forEach((customer) => {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: customer.position,
        title: customer.companyName,
        content: createMarkerContent(customer),
      });

      marker.addListener("gmp-click", () => {
        openInfoWindow(map, marker, customer);
      });

      markersRef.current.push(marker);
    });

    // Place cluster markers
    clusters.forEach((cluster) => {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: cluster.center,
        title: `${cluster.customers.length}件の顧客`,
        content: createClusterContent(cluster.customers.length, cluster.customers),
      });

      marker.addListener("gmp-click", () => {
        // Zoom in to break the cluster
        map.setCenter(cluster.center);
        map.setZoom((map.getZoom() || 10) + 3);
      });

      clusterMarkersRef.current.push(marker);
    });
  }, [clusterCustomers, createMarkerContent, createClusterContent]);

  // Open info window with doc progress
  const openInfoWindow = useCallback((map: google.maps.Map, marker: google.maps.marker.AdvancedMarkerElement, customer: GeocodedCustomer) => {
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }
    const docColor = getDocPinColor(customer.docProgress);
    const docLabel = getDocLabel(customer.docProgress);
    const progressPercent = customer.docProgress.total > 0
      ? Math.round((customer.docProgress.done / customer.docProgress.total) * 100)
      : 0;

    infoWindowRef.current.setContent(`
      <div style="padding:12px;max-width:280px;font-family:system-ui,-apple-system,sans-serif">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <h3 style="font-weight:700;font-size:15px;margin:0;color:#111827">${customer.companyName}</h3>
        </div>
        ${customer.contactName ? `<p style="font-size:13px;color:#4b5563;margin:4px 0">👤 ${customer.contactName}</p>` : ""}
        <p style="font-size:12px;color:#6b7280;margin:4px 0">📍 ${customer.address}</p>
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:11px;font-weight:600;color:${docColor}">${docLabel}</span>
            <span style="font-size:11px;color:#6b7280">${progressPercent}%</span>
          </div>
          <div style="height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${progressPercent}%;background:${docColor};border-radius:3px;transition:width 0.3s"></div>
          </div>
          <p style="font-size:10px;color:#9ca3af;margin-top:4px">${customer.docProgress.done}/${customer.docProgress.total} 書類取得済み</p>
        </div>
      </div>
    `);
    infoWindowRef.current.open(map, marker);
  }, []);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
    map.setCenter({ lat: 35.6812, lng: 139.7671 });
    map.setZoom(11);

    // Re-cluster on zoom change
    map.addListener("zoom_changed", () => {
      if (geocodedCustomers.length > 0) {
        placeMarkers(map, geocodedCustomers);
      }
    });
  }, [geocodedCustomers, placeMarkers]);

  // Trigger geocoding when both map and customers are ready
  useEffect(() => {
    if (mapReady && mapRef.current && customersWithAddress.length > 0 && !geocodingDoneRef.current) {
      geocodeAllCustomers(mapRef.current);
    }
  }, [mapReady, customersWithAddress, geocodeAllCustomers]);

  // 案件相談シートのお客様をジオコーディング
  useEffect(() => {
    if (mapReady && mapRef.current && consultationMsgs && consultationMsgs.length > 0 && !consultationGeocodedRef.current) {
      geocodeConsultationCustomers(mapRef.current);
    }
  }, [mapReady, consultationMsgs, geocodeConsultationCustomers]);

  // Re-render markers when filter changes
  useEffect(() => {
    if (mapRef.current && geocodedCustomers.length > 0 && !geocodingProgress) {
      placeMarkers(mapRef.current, filteredCustomers);
    }
  }, [filteredCustomers, placeMarkers, geocodingProgress, geocodedCustomers.length]);

  const togglePins = () => {
    const next = !showPins;
    setShowPins(next);
    markersRef.current.forEach((m) => { m.map = next ? mapRef.current : null; });
    clusterMarkersRef.current.forEach((m) => { m.map = next ? mapRef.current : null; });
  };

  const toggleConsultationPins = () => {
    const next = !showConsultationPins;
    setShowConsultationPins(next);
    consultationMarkersRef.current.forEach((m) => { m.map = next ? mapRef.current : null; });
  };

  const highlightCustomer = (customer: GeocodedCustomer) => {
    if (!mapRef.current) return;
    mapRef.current.panTo(customer.position);
    mapRef.current.setZoom(16);

    const idx = filteredCustomers.findIndex((c) => c.id === customer.id);
    // Find the marker for this customer
    const markerIdx = markersRef.current.findIndex((m) => m.title === customer.companyName);
    if (markerIdx >= 0 && markersRef.current[markerIdx]) {
      markersRef.current[markerIdx].content = createMarkerContent(customer, true);
      openInfoWindow(mapRef.current, markersRef.current[markerIdx], customer);
      setTimeout(() => {
        if (markersRef.current[markerIdx]) {
          markersRef.current[markerIdx].content = createMarkerContent(customer, false);
        }
      }, 3000);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showRoute = async () => {
    if (!mapRef.current || selectedIds.size < 2) {
      toast.error("ルート表示には2件以上の顧客を選択してください");
      return;
    }

    const selected = geocodedCustomers.filter((c) => selectedIds.has(c.id));
    if (selected.length < 2) {
      toast.error("有効な住所が2件以上必要です");
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
    }
    const renderer = new google.maps.DirectionsRenderer({
      map: mapRef.current,
      suppressMarkers: false,
      polylineOptions: { strokeColor: "#4f46e5", strokeWeight: 5, strokeOpacity: 0.8 },
    });

    const origin = selected[0].position;
    const destination = selected[selected.length - 1].position;
    const waypoints = selected.slice(1, -1).map((loc) => ({
      location: loc.position,
      stopover: true,
    }));

    try {
      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(
          {
            origin,
            destination,
            waypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === "OK" && result) resolve(result);
            else reject(status);
          }
        );
      });

      renderer.setDirections(result);
      directionsRendererRef.current = renderer;

      // Calculate total distance and duration
      const route = result.routes[0];
      if (route) {
        let totalDist = 0;
        let totalDur = 0;
        route.legs.forEach((leg) => {
          totalDist += leg.distance?.value || 0;
          totalDur += leg.duration?.value || 0;
        });
        const distKm = (totalDist / 1000).toFixed(1);
        const durMin = Math.round(totalDur / 60);
        const hours = Math.floor(durMin / 60);
        const mins = durMin % 60;
        setRouteInfo({
          distance: `${distKm} km`,
          duration: hours > 0 ? `${hours}時間${mins}分` : `${mins}分`,
        });
      }

      toast.success("最適な訪問ルートを表示しました");
    } catch {
      toast.error("ルートの計算に失敗しました");
    }
  };

  // PDF出力機能
  const exportRoutePDF = () => {
    const selected = geocodedCustomers.filter((c) => selectedIds.has(c.id));
    if (selected.length < 2 || !routeInfo) {
      toast.error("ルートを表示してからPDF出力してください");
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
    const timeStr = now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

    // HTML -> Print PDF
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("ポップアップがブロックされました。許可してください。");
      return;
    }

    const rows = selected.map((c, i) => {
      const statusLabel = c.docProgress.total === 0 ? "未着手" : c.docProgress.done === c.docProgress.total ? "完了" : `${c.docProgress.done}/${c.docProgress.total}`;
      const statusColor = c.docProgress.total === 0 ? "#ef4444" : c.docProgress.done === c.docProgress.total ? "#22c55e" : "#eab308";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:bold;color:#4f46e5;">${i + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${c.companyName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${c.contactName || "-"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${c.address}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;"><span style="background:${statusColor};color:white;padding:2px 8px;border-radius:4px;font-size:12px;">${statusLabel}</span></td>
      </tr>`;
    }).join("");

    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>訪問ルート - ${dateStr}</title>
      <style>
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', sans-serif; margin: 0; padding: 24px; color: #1f2937; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 24px; }
        .title { font-size: 22px; font-weight: 700; color: #1e1b4b; }
        .meta { font-size: 13px; color: #6b7280; text-align: right; }
        .summary { display: flex; gap: 16px; margin-bottom: 24px; }
        .summary-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
        .summary-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
        .summary-value { font-size: 20px; font-weight: 700; color: #1e1b4b; }
        table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        th { background: #4f46e5; color: white; padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600; }
        .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
      </style>
    </head><body>
      <div class="header">
        <div class="title">訪問ルート計画書</div>
        <div class="meta">出力日: ${dateStr} ${timeStr}<br>営業CRMシステム</div>
      </div>
      <div class="summary">
        <div class="summary-card"><div class="summary-label">訪問件数</div><div class="summary-value">${selected.length}件</div></div>
        <div class="summary-card"><div class="summary-label">総距離</div><div class="summary-value">${routeInfo.distance}</div></div>
        <div class="summary-card"><div class="summary-label">所要時間</div><div class="summary-value">${routeInfo.duration}</div></div>
      </div>
      <table>
        <thead><tr><th style="width:50px;text-align:center;">順番</th><th>会社名</th><th>担当者</th><th>住所</th><th style="width:80px;text-align:center;">書類</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">このルート計画書は営業CRMシステムから自動生成されました</div>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
    toast.success("PDF出力画面を開きました");
  };

  const clearRoute = () => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    setSelectedIds(new Set());
    setRouteInfo(null);
  };

  // Doc progress summary
  const docSummary = useMemo(() => {
    const counts = { complete: 0, partial: 0, none: 0 };
    geocodedCustomers.forEach((c) => {
      counts[getDocStatus(c.docProgress)]++;
    });
    return counts;
  }, [geocodedCustomers]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">訪問マップ</h1>
          <p className="text-muted-foreground text-sm mt-1">
            書類進捗に応じてピンを色分け表示 — 緑:完了 / 黄:途中 / 赤:未着手
          </p>
        </div>
        <div className="flex items-center gap-2">
          {geocodedCustomers.length > 0 && (
            <Badge variant="secondary" className="text-xs gap-1">
              <MapPin className="h-3 w-3" />
              {filteredCustomers.length}/{geocodedCustomers.length}件表示中
            </Badge>
          )}
        </div>
      </div>

      {/* Doc progress summary cards */}
      {geocodedCustomers.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card
            className={`p-3 cursor-pointer transition-all ${docFilter === "complete" ? "ring-2 ring-green-500" : "hover:bg-muted/50"}`}
            onClick={() => setDocFilter(docFilter === "complete" ? "all" : "complete")}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">書類完了</span>
              <span className="ml-auto text-sm font-semibold text-green-600">{docSummary.complete}</span>
            </div>
          </Card>
          <Card
            className={`p-3 cursor-pointer transition-all ${docFilter === "partial" ? "ring-2 ring-yellow-500" : "hover:bg-muted/50"}`}
            onClick={() => setDocFilter(docFilter === "partial" ? "all" : "partial")}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">書類途中</span>
              <span className="ml-auto text-sm font-semibold text-yellow-600">{docSummary.partial}</span>
            </div>
          </Card>
          <Card
            className={`p-3 cursor-pointer transition-all ${docFilter === "none" ? "ring-2 ring-red-500" : "hover:bg-muted/50"}`}
            onClick={() => setDocFilter(docFilter === "none" ? "all" : "none")}
          >
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">書類未着手</span>
              <span className="ml-auto text-sm font-semibold text-red-600">{docSummary.none}</span>
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Customer List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                顧客一覧
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={togglePins}
                  title={showPins ? "顧客ピンを非表示" : "顧客ピンを表示"}
                >
                  {showPins ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant={showConsultationPins ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 text-[10px] gap-1 ${showConsultationPins ? 'bg-violet-500 hover:bg-violet-600' : ''}`}
                  onClick={toggleConsultationPins}
                  title={showConsultationPins ? "案件相談シートピンを非表示" : "案件相談シートピンを表示"}
                >
                  <FileText className="h-3 w-3" />
                  相談{consultationCustomers.length > 0 ? ` ${consultationCustomers.length}` : ''}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="顧客名・住所で検索..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
              {searchText && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setSearchText("")}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Area filter */}
            {geocodedCustomers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                  <LocateFixed className="h-3 w-3" />
                  エリアフィルター
                </p>
                <Select value={selectedPrefecture} onValueChange={setSelectedPrefecture}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="都道府県" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全都道府県</SelectItem>
                    {availablePrefectures.map((pref) => (
                      <SelectItem key={pref} value={pref}>{pref}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPrefecture !== "all" && availableCities.length > 0 && (
                  <Select value={selectedCity} onValueChange={setSelectedCity}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="市区町村" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全市区町村</SelectItem>
                      {availableCities.map((city) => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {(selectedPrefecture !== "all" || selectedCity !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] w-full text-muted-foreground"
                    onClick={() => { setSelectedPrefecture("all"); setSelectedCity("all"); }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    エリアフィルターをクリア
                  </Button>
                )}
              </div>
            )}

            {/* Route controls */}
            {selectedIds.size > 0 && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={showRoute}
                    disabled={selectedIds.size < 2}
                  >
                    <Route className="h-3 w-3 mr-1" />
                    ルート表示 ({selectedIds.size}件)
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={clearRoute}>
                    クリア
                  </Button>
                </div>
                {routeInfo && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Navigation className="h-3 w-3 text-primary" />
                      <span className="font-medium">ルート情報</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>総距離: <strong className="text-foreground">{routeInfo.distance}</strong></span>
                      <span>所要時間: <strong className="text-foreground">{routeInfo.duration}</strong></span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs gap-1"
                      onClick={exportRoutePDF}
                    >
                      <Download className="h-3 w-3" />
                      ルートPDF出力
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Geocoding progress */}
            {geocodingProgress && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  住所を変換中... ({geocodingProgress.done}/{geocodingProgress.total})
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${(geocodingProgress.done / geocodingProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Customer list */}
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : geocodedCustomers.length === 0 && !geocodingProgress ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                住所が登録された顧客がありません
              </p>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                {filteredCustomers.map((customer) => {
                  const isSelected = selectedIds.has(customer.id);
                  const docColor = getDocPinColor(customer.docProgress);
                  const docStatus = getDocStatus(customer.docProgress);
                  const progressPercent = customer.docProgress.total > 0
                    ? Math.round((customer.docProgress.done / customer.docProgress.total) * 100)
                    : 0;
                  return (
                    <div
                      key={customer.id}
                      className={`group relative w-full text-left p-2.5 rounded-lg transition-all text-sm cursor-pointer ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/60 border border-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {/* Selection checkbox */}
                        <button
                          className={`mt-0.5 shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30 hover:border-primary/50"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(customer.id);
                          }}
                        >
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>

                        {/* Customer info */}
                        <div
                          className="min-w-0 flex-1"
                          onClick={() => highlightCustomer(customer)}
                        >
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: docColor }}
                            />
                            <p className="font-medium text-xs truncate">{customer.companyName}</p>
                          </div>
                          {customer.contactName && (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5 ml-4">
                              {customer.contactName}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5 ml-4">
                            {customer.address}
                          </p>
                          {/* Doc progress bar */}
                          <div className="mt-1 ml-4 flex items-center gap-2">
                            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${progressPercent}%`, backgroundColor: docColor }}
                              />
                            </div>
                            <span className="text-[9px] text-muted-foreground shrink-0">
                              {customer.docProgress.done}/{customer.docProgress.total}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredCustomers.length === 0 && (searchText || docFilter !== "all") && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    条件に一致する顧客がありません
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="lg:col-span-3">
          <CardContent className="p-0 overflow-hidden rounded-xl relative">
            <div className="h-[600px] lg:h-[700px]">
              <MapView onMapReady={handleMapReady} className="h-full" />
            </div>
            {/* Legend overlay */}
            <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">凡例（書類進捗）</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-[10px]">完了（全書類取得済み）</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-[10px]">途中（一部取得済み）</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-[10px]">未着手（書類なし）</span>
                </div>
                <div className="flex items-center gap-2 mt-1 pt-1 border-t">
                  <div className="w-3 h-3 rounded-full bg-indigo-500 flex items-center justify-center text-[7px] text-white font-bold">3</div>
                  <span className="text-[10px]">クラスタ（近接グループ）</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-violet-500" />
                  <span className="text-[10px]">案件相談シート（未対応）</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-[10px]">案件相談シート（対応済）</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
