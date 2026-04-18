/**
 * Admin/Director: System settings – inspiring layout with all fields.
 * Includes app name, contact (email, phone, WhatsApp), events, notifications, and features.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { AppPermissionsCard } from '@/components/AppPermissionsCard';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useAppRole } from '~/hooks/useAppRole';
import { useAppPermissionsStatus } from '~/hooks/useAppPermissionsStatus';
import { api } from '~/services/api';

type AppSettings = Record<string, string | number | boolean | null>;

const DEFAULTS: AppSettings = {
  app_name: 'Stagepass',
  company_name: 'Stagepass',
  app_support_email: '',
  support_phone: '',
  support_whatsapp_phone: '',
  timezone: 'Africa/Nairobi',
  date_format: 'd/m/Y',
  time_format: 'H:i',
  default_geofence_radius_m: 100,
  default_event_start_time: '09:00',
  default_event_end_time: '18:00',
  checkin_allowed_minutes_before: 60,
  notifications_email_enabled: true,
  notifications_sms_enabled: false,
  reminder_lead_hours: 24,
  default_equipment_condition: 'good',
  default_event_status: 'created',
  items_per_page: 20,
  allow_crew_self_checkin: true,
  require_geofence_for_checkin: true,
  payment_currency: 'KES',
  allow_time_off_requests: true,
  office_location_name: '',
  office_latitude: '',
  office_longitude: '',
  office_radius_m: 100,
  office_checkin_start_time: '09:00',
  office_checkin_end_time: '10:00',
};

const TIMEZONES = ['Africa/Nairobi', 'Africa/Lagos', 'Africa/Johannesburg', 'UTC', 'Europe/London', 'America/New_York'];

const DATE_FORMATS = [
  { value: 'd/m/Y', label: 'DD/MM/YYYY' },
  { value: 'm/d/Y', label: 'MM/DD/YYYY' },
  { value: 'Y-m-d', label: 'YYYY-MM-DD' },
];

const TIME_FORMATS = [
  { value: 'H:i', label: '24-hour' },
  { value: 'h:i A', label: '12-hour' },
];

const EQUIPMENT_CONDITIONS = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'out_of_service', label: 'Out of service' },
];

const EVENT_STATUSES = [
  { value: 'created', label: 'Created' },
  { value: 'active', label: 'Active' },
];

function getStr(v: unknown): string {
  if (v == null) return '';
  return String(v);
}
function getNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}
function getBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === '1' || v === 1) return true;
  return false;
}

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStagePassTheme();
  const role = useAppRole();
  const canEdit = role === 'admin' || role === 'team_leader'; // backend allows super_admin & director; mobile treats admin/team_leader as able to open; API will 403 if not allowed

  const [data, setData] = useState<AppSettings>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const appPermissions = useAppPermissionsStatus();

  const load = useCallback(async () => {
    try {
      const res = await api.settings.get();
      const merged = { ...DEFAULTS, ...(res && typeof res === 'object' ? (res as AppSettings) : {}) };
      setData(merged);
      setError(null);
    } catch {
      setData({ ...DEFAULTS });
      setError('Failed to load settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback((key: string, value: string | number | boolean) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      Object.keys(DEFAULTS).forEach((k) => {
        const v = data[k];
        payload[k] = v === undefined ? (DEFAULTS[k] ?? null) : v;
      });
      await api.settings.update(payload);
      await load();
      Alert.alert('Saved', 'Settings updated successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [canEdit, data, load]);

  const handleDownloadBackup = useCallback(async () => {
    setBackupError(null);
    setBackupLoading(true);
    try {
      const backupData = await api.backup.get();
      const json = JSON.stringify(backupData, null, 2);
      await Share.share({
        message: json,
        title: `Stagepass backup ${new Date().toISOString().slice(0, 10)}.json`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Backup failed. Admin/Director only.';
      setBackupError(msg);
      Alert.alert('Backup failed', msg);
    } finally {
      setBackupLoading(false);
    }
  }, []);

  const cardBg = colors.surface;
  const cardBorder = isDark ? themeYellow + '44' : themeBlue + '22';
  const bottomPad = insets.bottom + Spacing.xxl;

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Settings" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeYellow} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>Loading settings…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="System settings" showBack />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().then(() => appPermissions.refresh());
            }}
            tintColor={themeYellow}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={[styles.banner, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <ThemedText style={[styles.bannerText, { color: colors.error }]}>{error}</ThemedText>
          </View>
        ) : null}

        <AppPermissionsCard rows={appPermissions.rows} hint={appPermissions.hint} />

        {/* Application & contact */}
        <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <View style={[styles.iconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '66' }]}>
              <Ionicons name="business-outline" size={22} color={themeYellow} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Application & contact</ThemedText>
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>App name</ThemedText>
            <StagePassInput value={getStr(data.app_name)} onChangeText={(v) => update('app_name', v)} editable={canEdit} style={styles.input} />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Company name</ThemedText>
            <StagePassInput value={getStr(data.company_name)} onChangeText={(v) => update('company_name', v)} editable={canEdit} style={styles.input} />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Support email</ThemedText>
            <StagePassInput value={getStr(data.app_support_email)} onChangeText={(v) => update('app_support_email', v)} placeholder="support@example.com" editable={canEdit} style={styles.input} keyboardType="email-address" />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Support phone number</ThemedText>
            <StagePassInput value={getStr(data.support_phone)} onChangeText={(v) => update('support_phone', v)} placeholder="+254 700 000 000" editable={canEdit} style={styles.input} keyboardType="phone-pad" />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>WhatsApp support number</ThemedText>
            <StagePassInput value={getStr(data.support_whatsapp_phone)} onChangeText={(v) => update('support_whatsapp_phone', v)} placeholder="+254 700 000 000" editable={canEdit} style={styles.input} keyboardType="phone-pad" />
          </View>
          <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Timezone</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {TIMEZONES.map((tz) => (
              <ThemedText
                key={tz}
                onPress={() => canEdit && update('timezone', tz)}
                style={[styles.chip, data.timezone === tz ? { backgroundColor: isDark ? themeYellow : themeBlue, color: isDark ? themeBlue : themeYellow } : { backgroundColor: colors.inputBackground, color: colors.text }]}
              >
                {tz.split('/').pop()}
              </ThemedText>
            ))}
          </ScrollView>
          <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Date format</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {DATE_FORMATS.map((o) => (
              <ThemedText
                key={o.value}
                onPress={() => canEdit && update('date_format', o.value)}
                style={[styles.chip, getStr(data.date_format) === o.value ? { backgroundColor: isDark ? themeYellow : themeBlue, color: isDark ? themeBlue : themeYellow } : { backgroundColor: colors.inputBackground, color: colors.text }]}
              >
                {o.label}
              </ThemedText>
            ))}
          </ScrollView>
          <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Time format</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {TIME_FORMATS.map((o) => (
              <ThemedText
                key={o.value}
                onPress={() => canEdit && update('time_format', o.value)}
                style={[styles.chip, getStr(data.time_format) === o.value ? { backgroundColor: isDark ? themeYellow : themeBlue, color: isDark ? themeBlue : themeYellow } : { backgroundColor: colors.inputBackground, color: colors.text }]}
              >
                {o.label}
              </ThemedText>
            ))}
          </ScrollView>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Payment currency</ThemedText>
            <StagePassInput value={getStr(data.payment_currency)} onChangeText={(v) => update('payment_currency', v.slice(0, 6).toUpperCase())} editable={canEdit} style={styles.input} />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>List items per page</ThemedText>
            <StagePassInput value={String(getNum(data.items_per_page))} onChangeText={(v) => update('items_per_page', parseInt(v, 10) || 20)} editable={canEdit} keyboardType="number-pad" style={styles.input} />
          </View>
        </View>

        {/* Office location */}
        <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <View style={[styles.iconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '66' }]}>
              <Ionicons name="location-outline" size={22} color={themeYellow} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Office location</ThemedText>
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Office name / address</ThemedText>
            <StagePassInput value={getStr(data.office_location_name)} onChangeText={(v) => update('office_location_name', v)} placeholder="Office address" editable={canEdit} style={styles.input} />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Latitude</ThemedText>
            <StagePassInput value={getStr(data.office_latitude)} onChangeText={(v) => update('office_latitude', v)} placeholder="e.g. -1.292066" editable={canEdit} keyboardType="decimal-pad" style={styles.input} />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Longitude</ThemedText>
            <StagePassInput value={getStr(data.office_longitude)} onChangeText={(v) => update('office_longitude', v)} placeholder="e.g. 36.821946" editable={canEdit} keyboardType="decimal-pad" style={styles.input} />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Office geofence radius (m)</ThemedText>
            <StagePassInput value={String(getNum(data.office_radius_m) || 100)} onChangeText={(v) => update('office_radius_m', parseInt(v, 10) || 100)} editable={canEdit} keyboardType="number-pad" style={styles.input} />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Office check-in window</ThemedText>
            <View style={styles.rowTwo}>
              <StagePassInput value={getStr(data.office_checkin_start_time).slice(0, 5)} onChangeText={(v) => update('office_checkin_start_time', v)} editable={canEdit} style={styles.input} placeholder="09:00" />
              <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary, marginVertical: Spacing.sm }]}>to</ThemedText>
              <StagePassInput value={getStr(data.office_checkin_end_time).slice(0, 5)} onChangeText={(v) => update('office_checkin_end_time', v)} editable={canEdit} style={styles.input} placeholder="10:00" />
            </View>
          </View>
        </View>

        {/* Events & check-in */}
        <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={[styles.cardAccent, { backgroundColor: isDark ? themeYellow : themeBlue }]} />
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: isDark ? themeYellow : themeBlue }]} />
            <View style={[styles.iconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '18', borderColor: (isDark ? themeYellow : themeBlue) + '44' }]}>
              <Ionicons name="calendar-outline" size={22} color={colors.brandIcon} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Events & check-in</ThemedText>
          </View>
          <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Default event status</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {EVENT_STATUSES.map((o) => (
              <ThemedText
                key={o.value}
                onPress={() => canEdit && update('default_event_status', o.value)}
                style={[styles.chip, getStr(data.default_event_status) === o.value ? { backgroundColor: isDark ? themeYellow : themeBlue, color: isDark ? themeBlue : themeYellow } : { backgroundColor: colors.inputBackground, color: colors.text }]}
              >
                {o.label}
              </ThemedText>
            ))}
          </ScrollView>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Default geofence radius (m)</ThemedText>
            <StagePassInput value={String(getNum(data.default_geofence_radius_m))} onChangeText={(v) => update('default_geofence_radius_m', parseInt(v, 10) || 100)} editable={canEdit} keyboardType="number-pad" style={styles.input} />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Check-in allowed (min before start)</ThemedText>
            <StagePassInput value={String(getNum(data.checkin_allowed_minutes_before))} onChangeText={(v) => update('checkin_allowed_minutes_before', parseInt(v, 10) || 0)} editable={canEdit} keyboardType="number-pad" style={styles.input} />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Default event start time</ThemedText>
            <StagePassInput value={getStr(data.default_event_start_time).slice(0, 5)} onChangeText={(v) => update('default_event_start_time', v)} editable={canEdit} style={styles.input} />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Default event end time</ThemedText>
            <StagePassInput value={getStr(data.default_event_end_time).slice(0, 5)} onChangeText={(v) => update('default_event_end_time', v)} editable={canEdit} style={styles.input} />
          </View>
          <View style={styles.switchRow}>
            <ThemedText style={[styles.switchLabel, { color: colors.text }]}>Require geofence for check-in</ThemedText>
            <Switch value={getBool(data.require_geofence_for_checkin)} onValueChange={(v) => update('require_geofence_for_checkin', v)} disabled={!canEdit} trackColor={{ false: colors.border, true: themeYellow + '99' }} thumbColor={getBool(data.require_geofence_for_checkin) ? themeYellow : colors.textSecondary} />
          </View>
          <View style={styles.switchRow}>
            <ThemedText style={[styles.switchLabel, { color: colors.text }]}>Allow crew to self check-in</ThemedText>
            <Switch value={getBool(data.allow_crew_self_checkin)} onValueChange={(v) => update('allow_crew_self_checkin', v)} disabled={!canEdit} trackColor={{ false: colors.border, true: themeYellow + '99' }} thumbColor={getBool(data.allow_crew_self_checkin) ? themeYellow : colors.textSecondary} />
          </View>
        </View>

        {/* Notifications */}
        <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <View style={[styles.iconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '66' }]}>
              <Ionicons name="notifications-outline" size={22} color={themeYellow} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Notifications</ThemedText>
          </View>
          <View style={styles.switchRow}>
            <ThemedText style={[styles.switchLabel, { color: colors.text }]}>Email reminders</ThemedText>
            <Switch value={getBool(data.notifications_email_enabled)} onValueChange={(v) => update('notifications_email_enabled', v)} disabled={!canEdit} trackColor={{ false: colors.border, true: themeYellow + '99' }} thumbColor={getBool(data.notifications_email_enabled) ? themeYellow : colors.textSecondary} />
          </View>
          <View style={styles.switchRow}>
            <ThemedText style={[styles.switchLabel, { color: colors.text }]}>SMS reminders</ThemedText>
            <Switch value={getBool(data.notifications_sms_enabled)} onValueChange={(v) => update('notifications_sms_enabled', v)} disabled={!canEdit} trackColor={{ false: colors.border, true: themeYellow + '99' }} thumbColor={getBool(data.notifications_sms_enabled) ? themeYellow : colors.textSecondary} />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Reminder lead time (hours)</ThemedText>
            <StagePassInput value={String(getNum(data.reminder_lead_hours))} onChangeText={(v) => update('reminder_lead_hours', parseInt(v, 10) || 24)} editable={canEdit} keyboardType="number-pad" style={styles.input} />
          </View>
        </View>

        {/* Defaults & features */}
        <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={[styles.cardAccent, { backgroundColor: isDark ? themeYellow : themeBlue }]} />
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: isDark ? themeYellow : themeBlue }]} />
            <View style={[styles.iconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '18', borderColor: (isDark ? themeYellow : themeBlue) + '44' }]}>
              <Ionicons name="options-outline" size={22} color={colors.brandIcon} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Defaults & features</ThemedText>
          </View>
          <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Default equipment condition</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {EQUIPMENT_CONDITIONS.map((o) => (
              <ThemedText
                key={o.value}
                onPress={() => canEdit && update('default_equipment_condition', o.value)}
                style={[styles.chip, getStr(data.default_equipment_condition) === o.value ? { backgroundColor: isDark ? themeYellow : themeBlue, color: isDark ? themeBlue : themeYellow } : { backgroundColor: colors.inputBackground, color: colors.text }]}
              >
                {o.label}
              </ThemedText>
            ))}
          </ScrollView>
          <View style={styles.switchRow}>
            <ThemedText style={[styles.switchLabel, { color: colors.text }]}>Allow time-off requests from app</ThemedText>
            <Switch value={getBool(data.allow_time_off_requests)} onValueChange={(v) => update('allow_time_off_requests', v)} disabled={!canEdit} trackColor={{ false: colors.border, true: themeYellow + '99' }} thumbColor={getBool(data.allow_time_off_requests) ? themeYellow : colors.textSecondary} />
          </View>
        </View>

        {/* Backup */}
        <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <View style={[styles.iconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '66' }]}>
              <Ionicons name="cloud-download-outline" size={22} color={themeYellow} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Backup</ThemedText>
          </View>
          {backupError ? (
            <View style={[styles.banner, { backgroundColor: colors.error + '20', borderColor: colors.error, marginBottom: Spacing.md }]}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <ThemedText style={[styles.bannerText, { color: colors.error }]}>{backupError}</ThemedText>
            </View>
          ) : null}
          <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: Spacing.sm }]}>
            Download a JSON backup of users, events, and equipment. Admin/Director only.
          </ThemedText>
          <StagePassButton
            title={backupLoading ? 'Preparing…' : 'Download backup'}
            onPress={handleDownloadBackup}
            disabled={backupLoading}
            style={[styles.saveBtn, { backgroundColor: themeYellow }]}
          />
        </View>

        {canEdit && (
          <StagePassButton title={saving ? 'Saving…' : 'Save settings'} onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: themeYellow }]} />
        )}

        {!canEdit && (
          <View style={[styles.unauthorizedCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Ionicons name="lock-closed-outline" size={32} color={colors.textSecondary} />
            <ThemedText style={[styles.unauthorizedText, { color: colors.textSecondary }]}>Only Admin and Director can edit system settings.</ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 15 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.lg },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600' },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1, marginBottom: Spacing.lg, position: 'relative', overflow: 'hidden' },
  cardVibrant: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: BorderRadius.xl, borderBottomLeftRadius: BorderRadius.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  sectionTitleAccent: { width: 3, height: 16, borderRadius: 0 },
  iconWrap: { width: 40, height: 40, borderRadius: BorderRadius.lg, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs },
  input: {},
  chipRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  chip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, fontSize: 14, fontWeight: '600' },
  rowTwo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  switchLabel: { flex: 1, fontSize: 15, marginRight: Spacing.sm },
  saveBtn: { marginTop: Spacing.sm },
  unauthorizedCard: { padding: Spacing.xl, borderRadius: BorderRadius.lg, borderWidth: 1, alignItems: 'center', gap: Spacing.md },
  unauthorizedText: { textAlign: 'center', fontSize: 14 },
});
