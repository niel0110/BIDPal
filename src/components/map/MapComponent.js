'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, X, Search, Crosshair, ZoomIn, ZoomOut, Loader, ChevronDown, Clock, Edit2, Check } from 'lucide-react';
import styles from './MapComponent.module.css';
import 'leaflet/dist/leaflet.css';

const PROVINCES_FILTER = ['Davao del Sur', 'Cavite', 'Cebu', 'Quezon', 'Bulacan'];

export default function MapComponent({ onSelectLocation, onClose }) {
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reverseGeocode, setReverseGeocode] = useState(null);
  const [geolocating, setGeolocating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [activeProvince, setActiveProvince] = useState('');
  const [recentLocations, setRecentLocations] = useState([]);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editedAddress, setEditedAddress] = useState({});
  const mapContainer = useRef(null);
  const suggestionsRef = useRef(null);

  // Initialize map on component mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load recent locations from localStorage
    const stored = localStorage.getItem('recentLocations');
    if (stored) {
      setRecentLocations(JSON.parse(stored));
    }

    // Show guide after 2 seconds, auto-close after 8 seconds
    const guideTimer = setTimeout(() => {
      setShowGuide(true);
    }, 2000);

    const closeTimer = setTimeout(() => {
      setShowGuide(false);
    }, 10000);

    // Dynamically import Leaflet
    import('leaflet').then((L) => {
      if (mapContainer.current && !map && !mapContainer.current._leaflet_id) {
        // Fix Leaflet icon path issue (common with CDN)
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

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
      clearTimeout(guideTimer);
      clearTimeout(closeTimer);
      if (map) {
        map.off();
        map.remove();
        setMap(null);
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
      console.log('Reverse geocoding raw response:', data);
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
      province: reverseGeocode.province || '',
      country: reverseGeocode.country || 'Philippines'
    };

    console.log('Confirmed location data:', locationData);
    console.log('Reverse geocode result:', reverseGeocode);

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

  // Helper function to save location to recent locations
  const saveToRecentLocations = (location) => {
    setRecentLocations((prev) => {
      const filtered = prev.filter(
        (l) => l.latitude !== location.latitude || l.longitude !== location.longitude
      );
      const updated = [location, ...filtered].slice(0, 5); // Keep only 5 most recent
      localStorage.setItem('recentLocations', JSON.stringify(updated));
      return updated;
    });
  };

  // Handle recent location click
  const handleRecentLocationClick = (location) => {
    if (map) {
      map.setView([location.latitude, location.longitude], 15);
      import('leaflet').then((L) => {
        handleLocationSelect(location.latitude, location.longitude, map, L);
      });
    }
  };

  // Toggle address editing mode
  const toggleAddressEditMode = () => {
    if (!isEditingAddress) {
      // Enter edit mode
      setEditedAddress({
        address: reverseGeocode?.road || reverseGeocode?.residential || '',
        city: reverseGeocode?.city || reverseGeocode?.town || '',
        barangay: reverseGeocode?.suburb || '',
        region: reverseGeocode?.state || '',
        province: reverseGeocode?.province || ''
      });
    }
    setIsEditingAddress(!isEditingAddress);
  };

  // Update edited address field
  const updateEditedAddressField = (field, value) => {
    setEditedAddress((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // Save edited address changes
  const saveEditedAddress = () => {
    setReverseGeocode({
      ...reverseGeocode,
      road: editedAddress.address,
      city: editedAddress.city,
      suburb: editedAddress.barangay,
      state: editedAddress.region,
      province: editedAddress.province
    });
    setIsEditingAddress(false);
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

        <div className={styles.searchFilterRow}>
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

          <div className={styles.provinceFilterSection}>
            <label className={styles.filterLabel}>
              <ChevronDown size={16} />
              Filter:
            </label>
            <select
              value={activeProvince}
              onChange={(e) => setActiveProvince(e.target.value)}
              className={styles.provinceSelect}
            >
              <option value="">All Provinces</option>
              {PROVINCES_FILTER.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Wrapper - Side by Side Layout */}
        <div className={styles.contentWrapper}>
          {/* Map Side */}
          <div className={styles.mapSide}>
            {/* Controls Panel - Recent Locations */}
            <div className={styles.controlsPanel}>

              {/* Recent Locations Section */}
              {recentLocations.length > 0 && (
                <div className={styles.recentLocationsSection}>
                  <div className={styles.sectionHeader}>
                    <Clock size={16} />
                    <span>Recent Locations</span>
                  </div>
                  <div className={styles.recentLocationsList}>
                    {recentLocations.map((location, idx) => (
                      <button
                        key={idx}
                        className={styles.recentLocationItem}
                        onClick={() => handleRecentLocationClick(location)}
                        title={`${location.address}, ${location.city}`}
                      >
                        <div className={styles.recentLocationText}>
                          <div className={styles.recentLocationAddress}>
                            {location.address || location.city}
                          </div>
                          <div className={styles.recentLocationDetails}>
                            {location.city}{location.barangay ? ` • ${location.barangay}` : ''}
                          </div>
                        </div>
                        <MapPin size={14} />
                      </button>
                    ))}
                  </div>
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
          </div>

          {/* Details Side */}
          {reverseGeocode && selectedCoords && (
            <div className={styles.detailsSide}>
              <div className={styles.selectedInfo}>
                <div className={styles.infoHeader}>
                  <div className={styles.infoTitle}>
                    <MapPin size={18} />
                    <h3>Location Details</h3>
                  </div>
                  <div className={styles.headerActions}>
                    <button
                      className={`${styles.editBtn} ${isEditingAddress ? styles.active : ''}`}
                      onClick={toggleAddressEditMode}
                      title={isEditingAddress ? 'Exit Edit Mode' : 'Edit Address'}
                    >
                      {isEditingAddress ? <Check size={16} /> : <Edit2 size={16} />}
                    </button>
                    <button
                      className={styles.clearBtn}
                      onClick={handleClearLocation}
                      title="Clear selection"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {isEditingAddress ? (
                  <div className={styles.addressEditor}>
                    <div className={styles.editField}>
                      <label>Street Address</label>
                      <input
                        type="text"
                        value={editedAddress.address}
                        onChange={(e) => updateEditedAddressField('address', e.target.value)}
                        placeholder="Street address"
                        className={styles.editInput}
                      />
                    </div>
                    <div className={styles.editField}>
                      <label>Barangay</label>
                      <input
                        type="text"
                        value={editedAddress.barangay}
                        onChange={(e) => updateEditedAddressField('barangay', e.target.value)}
                        placeholder="Barangay"
                        className={styles.editInput}
                      />
                    </div>
                    <div className={styles.twoColumns}>
                      <div className={styles.editField}>
                        <label>City</label>
                        <input
                          type="text"
                          value={editedAddress.city}
                          onChange={(e) => updateEditedAddressField('city', e.target.value)}
                          placeholder="City"
                          className={styles.editInput}
                        />
                      </div>
                      <div className={styles.editField}>
                        <label>Province</label>
                        <input
                          type="text"
                          value={editedAddress.province}
                          onChange={(e) => updateEditedAddressField('province', e.target.value)}
                          placeholder="Province"
                          className={styles.editInput}
                        />
                      </div>
                    </div>
                    <div className={styles.editField}>
                      <label>Region</label>
                      <input
                        type="text"
                        value={editedAddress.region}
                        onChange={(e) => updateEditedAddressField('region', e.target.value)}
                        placeholder="Region"
                        className={styles.editInput}
                      />
                    </div>
                    <div className={styles.editActions}>
                      <button
                        className={styles.cancelEditBtn}
                        onClick={() => setIsEditingAddress(false)}
                      >
                        Cancel
                      </button>
                      <button className={styles.saveEditBtn} onClick={saveEditedAddress}>
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
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
                    {reverseGeocode.province && (
                      <div className={styles.infoRow}>
                        <span className={styles.label}>Province</span>
                        <span className={styles.value}>{reverseGeocode.province}</span>
                      </div>
                    )}
                    {reverseGeocode.state && (
                      <div className={styles.infoRow}>
                        <span className={styles.label}>Region</span>
                        <span className={styles.value}>{reverseGeocode.state}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.mapActions}>
                  <button className={styles.cancelBtn} onClick={onClose}>
                    Cancel
                  </button>
                  <button className={styles.confirmBtn} onClick={handleConfirm}>
                    Confirm Location
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner}></div>
            <p>Loading location...</p>
          </div>
        )}

        {/* Help Guide Overlay */}
        {showGuide && (
          <div className={styles.guideOverlay} onClick={() => setShowGuide(false)}>
            <div className={styles.guideContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.guideHeader}>
                <h3>How to Select Your Location</h3>
                <button
                  className={styles.guideCloseBtn}
                  onClick={() => setShowGuide(false)}
                  title="Close guide"
                >
                  <X size={20} />
                </button>
              </div>
              <div className={styles.guideSteps}>
                <div className={styles.guideStep}>
                  <div className={styles.stepNumber}>1</div>
                  <div className={styles.stepContent}>
                    <strong>Click on the map</strong> to select your location or use the search bar to find specific areas
                  </div>
                </div>
                <div className={styles.guideStep}>
                  <div className={styles.stepNumber}>2</div>
                  <div className={styles.stepContent}>
                    <strong>Review location details</strong> and edit if needed using the edit button
                  </div>
                </div>
                <div className={styles.guideStep}>
                  <div className={styles.stepNumber}>3</div>
                  <div className={styles.stepContent}>
                    <strong>Confirm your selection</strong> to save and use this location
                  </div>
                </div>
              </div>
              <button
                className={styles.guideActionBtn}
                onClick={() => setShowGuide(false)}
              >
                Got it, let's go!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
