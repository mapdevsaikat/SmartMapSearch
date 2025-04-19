import React, { useState, useEffect } from 'react';
import Map, { Marker, NavigationControl, GeolocateControl } from 'react-map-gl/maplibre';
import { MapPin } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Location {
  lat: number;
  lon: number;
  display_name: string;
}

interface MapViewProps {
  locations: Location[];
  selectedLocation: number | null;
  onLocationSelect: (index: number) => void;
}

export default function MapView({ locations, selectedLocation, onLocationSelect }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [viewState, setViewState] = useState({
    latitude: 22.5074, // Default to center of India
    longitude: 82.1278,
    zoom: 4
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (isInitialLoad) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
          setViewState({
            latitude,
            longitude,
            zoom: 13 // Slightly reduced zoom level for better context
          });
          setIsInitialLoad(false);
        },
        (error) => {
          console.warn('Location error:', error.message);
          // Handle specific error codes
          let errorMessage = 'Unable to get your location. ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Please enable location services to use nearby search features.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location information is currently unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Location request timed out.';
              break;
            default:
              errorMessage += 'An unknown error occurred.';
          }
          console.warn(errorMessage);
          
          // Keep the default view state (India center)
          setIsInitialLoad(false);
        },
        {
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
          enableHighAccuracy: false // Disable high accuracy for better compatibility
        }
      );
    }
  }, [isInitialLoad]);

  useEffect(() => {
    if (!isInitialLoad && selectedLocation !== null && locations[selectedLocation]) {
      setViewState({
        latitude: locations[selectedLocation].lat,
        longitude: locations[selectedLocation].lon,
        zoom: 14
      });
    } else if (!isInitialLoad && locations.length > 0) {
      // If no location is selected but we have search results, show all results
      const bounds = getBounds(locations);
      setViewState({
        latitude: (bounds.north + bounds.south) / 2,
        longitude: (bounds.east + bounds.west) / 2,
        zoom: calculateZoomLevel(bounds)
      });
    }
  }, [locations, selectedLocation, isInitialLoad]);

  // Helper function to calculate bounds for a set of locations
  const getBounds = (locs: Location[]) => {
    let north = -90, south = 90, east = -180, west = 180;
    locs.forEach(loc => {
      north = Math.max(north, loc.lat);
      south = Math.min(south, loc.lat);
      east = Math.max(east, loc.lon);
      west = Math.min(west, loc.lon);
    });
    return { north, south, east, west };
  };

  // Helper function to calculate appropriate zoom level based on bounds
  const calculateZoomLevel = (bounds: { north: number; south: number; east: number; west: number }) => {
    const latDiff = bounds.north - bounds.south;
    const lonDiff = bounds.east - bounds.west;
    const maxDiff = Math.max(latDiff, lonDiff);
    return Math.round(14 - Math.log2(maxDiff * 10)); // Adjust multiplier for desired zoom level
  };

  return (
    <div className="relative h-full">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle={`https://api.maptiler.com/maps/streets/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`}
      >
        <NavigationControl position="top-right" />
        <GeolocateControl
          position="top-right"
          trackUserLocation
          showUserLocation
          onGeolocate={(position) => {
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          }}
        />
        
        {locations.map((location, index) => (
          <Marker
            key={index}
            latitude={location.lat}
            longitude={location.lon}
            anchor="bottom"
            onClick={() => onLocationSelect(index)}
          >
            <div className="relative group">
              <div className={`transition-all duration-300 ${selectedLocation === index ? 'animate-bounce' : ''}`}>
                <MapPin 
                  className={`w-8 h-8 transition-colors ${
                    selectedLocation === index 
                      ? 'text-red-500 scale-110' 
                      : 'text-blue-500 hover:text-blue-600'
                  }`} 
                />
              </div>
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-white dark:bg-gray-800 px-3 py-1 rounded-lg shadow-lg text-sm max-w-xs text-gray-800 dark:text-white">
                  {location.display_name}
                </div>
              </div>
            </div>
          </Marker>
        ))}

        {userLocation && (
          <Marker
            latitude={userLocation.latitude}
            longitude={userLocation.longitude}
            anchor="center"
          >
            <div className="relative">
              <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 shadow-lg pulse-animation">
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
              </div>
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2">
                <div className="bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-lg text-sm whitespace-nowrap text-gray-800 dark:text-white">
                  You are here
                </div>
              </div>
            </div>
          </Marker>
        )}
      </Map>
    </div>
  );
}