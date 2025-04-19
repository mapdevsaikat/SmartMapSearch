import React, { useState } from 'react';
import { Map as MapIcon, Navigation } from 'lucide-react';
import SearchBar from './components/SearchBar';
import MapView from './components/Map';
import ThemeToggle from './components/ThemeToggle';
import BottomSheet from './components/BottomSheet';
import { searchLocations as searchLocationsApi } from './services/mistral';

interface Location {
  lat: number;
  lon: number;
  display_name: string;
}

function App() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedResults, setExpandedResults] = useState(false);
  const [searchContext, setSearchContext] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setIsLoading(true);
    setError(null);
    setSelectedLocation(null);
    setExpandedResults(false);
    setSearchContext(null);

    try {
      // Get user's current position if needed
      let userPosition: GeolocationPosition | null = null;
      const hasLocationQuery = query.toLowerCase().includes('near me') || query.toLowerCase().includes('nearby');
      if (hasLocationQuery) {
        userPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000
          });
        });
      }
      
      try {
        const parsedContext = await parseSearchQuery(query, undefined);
        setSearchContext(
          parsedContext.intent?.primary 
            ? `Searching for: ${parsedContext.searchTerm} (${parsedContext.intent.primary})`
            : `Searching for: ${parsedContext.searchTerm}`
        );
      } catch (contextError) {
        console.warn('Context analysis failed:', contextError);
      }        

      if (query.toLowerCase().includes('near me') || query.toLowerCase().includes('nearby')) {
        userPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
      }

      // Search locations using the enhanced search function
      const results = await searchLocationsApi(
        query,
        userPosition ? {
          latitude: userPosition.coords.latitude,
          longitude: userPosition.coords.longitude
        } : undefined
      );

      // Process and display results
      if (results.length === 0) {
        setError('No locations found. Try a different search term.');
      } else {
        // Sort by distance if user position is available
        if (userPosition) {
          results.sort((a: Location, b: Location) => {
            const distA = calculateDistance(
              userPosition.coords.latitude,
              userPosition.coords.longitude,
              a.lat,
              a.lon
            );
            const distB = calculateDistance(
              userPosition.coords.latitude,
              userPosition.coords.longitude,
              b.lat,
              b.lon
            );
            return distA - distB;
          });
        }

        setLocations(results.slice(0, expandedResults ? 10 : 5));
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Failed to search locations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setLocations([]);
    setSelectedLocation(null);
    setError(null);
    setSearchContext(null);
    setSearchQuery('');
    setExpandedResults(false);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleNavigate = async (location: Location) => {
    try {
      // Try to use the Web Share API first
      if (navigator.share) {
        await navigator.share({
          title: location.display_name,
          text: `Navigate to ${location.display_name}`,
          url: `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lon}`
        });
      } else {
        // Fallback to opening Google Maps directly
        window.open(
          `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lon}`,
          '_blank'
        );
      }
    } catch (error) {
      console.error('Error sharing location:', error);
      // Fallback to opening Google Maps directly if sharing fails
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lon}`,
        '_blank'
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <ThemeToggle />
      <div className="h-screen flex flex-col">
        <div className="px-4 py-4 md:py-8">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center mb-2">
              <MapIcon className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              Smart Map Search
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Try "find me Italian restaurants open now" or "cafes with outdoor seating nearby"
            </p>
          </div>

          <div className="flex flex-col items-center">
            <SearchBar 
              onSearch={handleSearch} 
              onClear={clearSearch}
              isLoading={isLoading}
              value={searchQuery}
            />
            {error && (
              <div className="mt-4 text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative">
          <MapView 
            locations={locations} 
            selectedLocation={selectedLocation}
            onLocationSelect={setSelectedLocation}
          />

          <BottomSheet 
            isOpen={locations.length > 0}
            title="Search Results"
            resultsCount={locations.length}
            onClose={clearSearch}
          >
            <div className="space-y-4 px-4 py-2">
              {searchContext && (
                <div className="text-sm text-gray-500 dark:text-gray-400 pb-2 border-b dark:border-gray-700">
                  {searchContext}
                </div>
              )}
              {locations.map((location, index) => (
                <div
                  key={index}
                  className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer border ${
                    selectedLocation === index 
                      ? 'border-blue-500 dark:border-blue-400' 
                      : 'border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1" onClick={() => setSelectedLocation(index)}>
                      <h3 className="font-medium text-gray-800 dark:text-white">{location.display_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Coordinates: {location.lat}, {location.lon}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNavigate(location)}
                      className="ml-4 p-2 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      title="Navigate to this location"
                    >
                      <Navigation size={20} />
                    </button>
                  </div>
                </div>
              ))}
              {locations.length === 5 && !expandedResults && (
                <button
                  onClick={() => {
                    setExpandedResults(true);
                    handleSearch(searchQuery);
                  }}
                  className="w-full py-2 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-center"
                >
                  Show more results
                </button>
              )}
            </div>
          </BottomSheet>
        </div>
      </div>
    </div>
  );
}

export default App;