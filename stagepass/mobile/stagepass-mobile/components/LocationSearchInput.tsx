/**
 * Location input with Google Places Autocomplete (REST).
 * When a place is selected, calls onSelect with { location_name, latitude, longitude }.
 * If EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set, behaves as a plain text input.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
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
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef('');

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    Keyboard.dismiss();
    setOpen(true);
    setLoading(true);
    try {
      const list = await fetchPlaceSuggestions(query);
      setSuggestions(list);
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

  const showSuggestions = hasGooglePlacesKey() && open;

  const closeDropdown = useCallback(() => {
    setOpen(false);
  }, []);

  const useTypedTextAsLocation = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      closeDropdown();
      return;
    }
    onChange(trimmed);
    if (onSelect) {
      onSelect({
        location_name: trimmed,
        latitude: 0,
        longitude: 0,
      });
    }
    closeDropdown();
  }, [value, onChange, onSelect, closeDropdown]);

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
        onFocus={() => value.trim() && setOpen(true)}
        onBlur={() => {
          if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
          blurTimeoutRef.current = setTimeout(() => {
            blurTimeoutRef.current = null;
            closeDropdown();
          }, 400);
        }}
      />
      {loading && (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={colors.tint} />
        </View>
      )}
      {showSuggestions && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeDropdown}
          statusBarTranslucent
        >
          <Pressable style={styles.modalBackdrop} onPress={closeDropdown}>
            <Pressable
              style={[styles.modalListCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              {loading ? (
                <View style={styles.modalLoader}>
                  <ActivityIndicator size="small" color={colors.tint} />
                  <ThemedText style={[styles.modalLoaderText, { color: colors.textSecondary }]}>Searching…</ThemedText>
                </View>
              ) : suggestions.length === 0 ? (
                <View style={styles.modalEmptyWrap}>
                  <ThemedText style={[styles.modalEmpty, { color: colors.textSecondary }]}>No places found</ThemedText>
                  <ThemedText style={[styles.modalEmptySub, { color: colors.textSecondary }]}>
                    Try a different search or use the text as the venue name.
                  </ThemedText>
                  {value.trim().length > 0 && (
                    <TouchableOpacity
                      style={[styles.useAsNameBtn, { backgroundColor: colors.tint, borderColor: colors.border }]}
                      onPress={useTypedTextAsLocation}
                      activeOpacity={0.8}
                    >
                      <ThemedText style={styles.useAsNameBtnText}>Use &quot;{value.trim()}&quot; as location name</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <ScrollView
                  style={styles.modalList}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={suggestions.length > 4}
                >
                  {suggestions.map((item) => (
                    <TouchableOpacity
                      key={item.placeId}
                      style={[styles.row, { borderBottomColor: colors.border }]}
                      onPress={() => handleSelect(item)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={[styles.suggestionText, { color: colors.text }]} numberOfLines={2}>
                        {item.text}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </Pressable>
          </Pressable>
        </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 80,
    paddingHorizontal: Spacing.lg,
  },
  modalListCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    maxHeight: 320,
    minHeight: 120,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 16,
  },
  modalLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  modalLoaderText: {
    fontSize: 15,
  },
  modalEmptyWrap: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  modalEmpty: {
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
  modalEmptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  useAsNameBtn: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  useAsNameBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f1838',
  },
  modalList: {
    maxHeight: 316,
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
