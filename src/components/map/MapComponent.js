'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, X, Search, Crosshair, ZoomIn, ZoomOut, Loader } from 'lucide-react';
import styles from './MapComponent.module.css';
import 'leaflet/dist/leaflet.css';

export default function MapComponent({ onSelectLocation, onClose }) {
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reverseGeocode, setReverseGeocode] = useState(null);
  const [geolocating, setGeolocating] = useState(false);
  const mapContainer = useRef(null);
  const suggestionsRef = useRef(null);

  // Initialize map on component mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Dynamically import Leaflet
    import('leaflet').then((L) => {
      if (mapContainer.current && !map) {
        // Default center (Davao City)
        const defaultCenter = [7.0731, 125.6263];

        const leafletMap = L.map(mapContainer.current).setView(defaultCenter, 12);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(leafletMap);

        // Add click handler to map
        leafletMap.on('click', (e) => {
          const { lat, lng } = e.latlng;
          handleLocationSelect(lat, lng, leafletMap, L);
        });

        // Try to get user's current location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              leafletMap.setView([latitude, longitude], 15);
              handleLocationSelect(latitude, longitude, leafletMap, L);
            },
            () => {
              // Use default if geolocation fails
            }
          );
        }

        setMap(leafletMap);
      }
    });

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  const handleLocationSelect = async (lat, lng, leafletMap, L) => {
    setSelectedCoords({ lat, lng });

    // Remove existing marker
    if (marker) {
      marker.remove();
    }

    // Add new marker
    const newMarker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(leafletMap);

    setMarker(newMarker);
    leafletMap.setView([lat, lng], 15);

    // Reverse geocoding using OSM Nominatim
    try {
      setLoading(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      setReverseGeocode(data.address || {});
    } catch (err) {
      console.error('Reverse geocoding error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query + ' Philippines'
        )}&limit=5`
      );
      const data = await response.json();
      setSuggestions(data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = async (suggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);

    import('leaflet').then((L) => {
      if (map) {
        handleLocationSelect(lat, lng, map, L);
        setSuggestions([]);
        setSearchQuery('');
      }
    });
  };

  const handleConfirm = () => {
    if (!selectedCoords || !reverseGeocode) {
      alert('Please select a location on the map');
      return;
    }

    const locationData = {
      latitude: selectedCoords.lat,
      longitude: selectedCoords.lng,
      address: reverseGeocode.road || reverseGeocode.residential || 'Selected Location',
      city: reverseGeocode.city || reverseGeocode.town || '',
      barangay: reverseGeocode.suburb || '',
      region: reverseGeocode.state || '',
      country: reverseGeocode.country || 'Philippines'
    };

    onSelectLocation(locationData);
  };

  const handleZoomIn = () => {
    if (map) {
      map.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (map) {
      map.zoomOut();
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser');
      return;
    }

    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (map) {
          map.setView([latitude, longitude], 15);
          import('leaflet').then((L) => {
            handleLocationSelect(latitude, longitude, map, L);
          });
        }
        setGeolocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please try again.');
        setGeolocating(false);
      }
    );
  };

  const handleClearLocation = () => {
    if (marker) {
      marker.remove();
      setMarker(null);
    }
    setSelectedCoords(null);
    setReverseGeocode(null);
    setSearchQuery('');
    setSuggestions([]);
  };

  return (
    <div className={styles.mapOverlay}>
      <div className={styles.mapContainer}>
        <div className={styles.mapHeader}>
          <div className={styles.headerContent}>
            <MapPin size={24} color="var(--color-primary)" />
            <div>
              <h2>Select Your Location</h2>
              <p className={styles.headerSubtitle}>Click on the map or search to find your address</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (ESC)">
            <X size={24} />
          </button>
        </div>

        <div className={styles.searchBox}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Search location in Philippines..."
            value={searchQuery}
            onChange={handleSearch}
            className={styles.searchInput}
          />
          {suggestions.length > 0 && (
            <div className={styles.suggestionsDropdown} ref={suggestionsRef}>
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className={styles.suggestionItem}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <MapPin size={16} />
                  <span>{suggestion.display_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.mapWrapper}>
          <div ref={mapContainer} className={styles.map}></div>
          
          {/* Map Controls */}
          <div className={styles.mapControls}>
            <button
              className={styles.mapControl}
              onClick={handleZoomIn}
              title="Zoom In (+)"
              aria-label="Zoom in"
            >
              <ZoomIn size={20} />
            </button>
            <button
              className={styles.mapControl}
              onClick={handleZoomOut}
              title="Zoom Out (-)"
              aria-label="Zoom out"
            >
              <ZoomOut size={20} />
            </button>
            <div className={styles.controlDivider}></div>
            <button
              className={`${styles.mapControl} ${geolocating ? styles.loading : ''}`}
              onClick={handleCurrentLocation}
              disabled={geolocating}
              title="Current Location"
              aria-label="Go to current location"
            >
              {geolocating ? <Loader size={20} className={styles.spinnerIcon} /> : <Crosshair size={20} />}
            </button>
          </div>
        </div>

        {reverseGeocode && selectedCoords && (
          <div className={styles.selectedInfo}>
            <div className={styles.infoHeader}>
              <div className={styles.infoTitle}>
                <MapPin size={18} />
                <h3>Location Details</h3>
              </div>
              <button
                className={styles.clearBtn}
                onClick={handleClearLocation}
                title="Clear selection"
              >
                Clear
              </button>
            </div>

            <div className={styles.infoContent}>
              <div className={styles.infoRow}>
                <span className={styles.label}>Address</span>
                <span className={styles.value}>
                  {reverseGeocode.road || reverseGeocode.residential || 'Selected Location'}
                </span>
              </div>
              {reverseGeocode.suburb && (
                <div className={styles.infoRow}>
                  <span className={styles.label}>Barangay</span>
                  <span className={styles.value}>{reverseGeocode.suburb}</span>
                </div>
              )}
              {reverseGeocode.city && (
                <div className={styles.infoRow}>
                  <span className={styles.label}>City</span>
                  <span className={styles.value}>{reverseGeocode.city}</span>
                </div>
              )}
              {reverseGeocode.state && (
                <div className={styles.infoRow}>
                  <span className={styles.label}>Region</span>
                  <span className={styles.value}>{reverseGeocode.state}</span>
                </div>
              )}
              <div className={styles.infoRow}>
                <span className={styles.label}>Coordinates</span>
                <span className={styles.coordinate}>
                  {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
                </span>
              </div>
            </div>

            <div className={styles.mapActions}>
              <button className={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button className={styles.confirmBtn} onClick={handleConfirm}>
                Confirm Location
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner}></div>
            <p>Loading location...</p>
          </div>
        )}
      </div>
    </div>
  );
}
