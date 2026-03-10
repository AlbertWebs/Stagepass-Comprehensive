/**
 * Location input with Google Places Autocomplete (REST).
 * When a place is selected, calls onSelect with { location_name, latitude, longitude }.
 * If EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set, behaves as a plain text input.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import {
  fetchPlaceDetails,
  fetchPlaceSuggestions,
  hasGooglePlacesKey,
  type PlaceDetails,
  type PlaceSuggestion,
} from '~/services/googlePlaces';

export type LocationResult = PlaceDetails;

type LocationSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (result: LocationResult) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: object;
};

const DEBOUNCE_MS = 320;

export function LocationSearchInput({
  value,
  onChange,
  onSelect,
  placeholder = 'Search venue or address…',
  disabled,
  style,
}: LocationSearchInputProps) {
  const { colors } = useStagePassTheme();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef('');

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchPlaceSuggestions(query);
      setSuggestions(list);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!hasGooglePlacesKey()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const q = value.trim();
    lastQueryRef.current = q;
    if (!q) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      fetchSuggestions(q);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  const handleSelect = useCallback(
    async (item: PlaceSuggestion) => {
      setOpen(false);
      setSuggestions([]);
      onChange(item.text);
      if (!onSelect) return;
      const details = await fetchPlaceDetails(item.placeId);
      if (details) {
        onChange(details.location_name);
        onSelect(details);
      }
    },
    [onChange, onSelect]
  );

  const showSuggestions = hasGooglePlacesKey() && open && (suggestions.length > 0 || loading);

  return (
    <View style={[styles.wrap, style]}>
      <StagePassInput
        value={value}
        onChangeText={(text) => {
          onChange(text);
          if (!text.trim()) setOpen(false);
        }}
        placeholder={hasGooglePlacesKey() ? placeholder : 'Venue or address'}
        editable={!disabled}
        style={styles.input}
        onFocus={() => value.trim() && suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {loading && (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={colors.tint} />
        </View>
      )}
      {showSuggestions && (
        <View style={[styles.listWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {!loading && suggestions.length === 0 ? null : (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.placeId}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[styles.suggestionText, { color: colors.text }]} numberOfLines={2}>
                    {item.text}
                  </ThemedText>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 10,
  },
  input: {
    marginBottom: 0,
  },
  loaderWrap: {
    position: 'absolute',
    right: Spacing.md,
    top: 14,
  },
  listWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    maxHeight: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  list: {
    maxHeight: 216,
  },
  row: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  suggestionText: {
    fontSize: 15,
  },
});
