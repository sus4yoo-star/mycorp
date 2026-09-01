import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import type { Division } from '@mycorp24/agent-types';
import type { FounderIdentity } from '@mycorp24/types';
import {
  formatFloor,
  morningGreeting,
  resolveFloorStack,
  resolvePreset,
  sortTopDown,
} from '@mycorp24/business-logic';

/**
 * Mobile home — spec §74.
 *
 * The founder's phone is not a smaller headquarters. It leads with the morning
 * briefing and what needs a decision; the building is a summary, not the point.
 *
 * Everything shown here is computed by the same shared packages the web app
 * uses. That is the architectural claim of spec §73, exercised rather than
 * asserted: floor numbers and the form of address are not duplicated per
 * platform.
 */

const FOUNDER: FounderIdentity = {
  ownerDisplayName: '유상철',
  preferredTitle: '회장님',
  locale: 'ko-KR',
  addressForm: 'title_only',
};

export default function App() {
  const dark = useColorScheme() === 'dark';
  const t = dark ? darkTheme : lightTheme;

  const preset = resolvePreset('LOCAL_BUSINESS');
  const floors = sortTopDown(resolveFloorStack(preset.divisions as Division[]));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.ground }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.wordmark, { color: t.ink }]}>MYCORP24</Text>

        <Text style={[styles.greeting, { color: t.ink }]}>
          {morningGreeting(FOUNDER)}
        </Text>
        <Text style={[styles.brief, { color: t.inkSoft }]}>
          오늘 직접 결정하셔야 할 일은 2건입니다.
        </Text>

        <View style={[styles.card, { backgroundColor: t.paper, borderColor: t.line }]}>
          <Text style={[styles.cardTitle, { color: t.inkSoft }]}>결재 대기</Text>
          <Text style={[styles.cardBody, { color: t.ink }]}>
            CMO가 Meta 광고 증액안을 결재 요청했습니다.
          </Text>
          <Text style={[styles.cardBody, { color: t.ink }]}>
            운영본부가 주말 가격 변경안을 올렸습니다.
          </Text>
          <Text style={[styles.note, { color: t.inkSoft }]}>
            AI prepares. Founder approves. Company executes.
          </Text>
        </View>

        <Text style={[styles.section, { color: t.inkSoft }]}>본사</Text>
        <View style={[styles.card, { backgroundColor: t.paper, borderColor: t.line }]}>
          {floors.map((f) => (
            <View key={String(f.floor)} style={styles.row}>
              <Text style={[styles.floorNum, { color: f.isTop ? t.ink : t.inkSoft }]}>
                {formatFloor(f)}
              </Text>
              <Text
                style={[
                  styles.floorName,
                  { color: t.ink, fontWeight: f.isTop ? '700' : '400' },
                ]}
              >
                {f.divisions.map((d) => d.ko).join(' · ')}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.footer, { color: t.inkSoft }]}>
          MYCORP24 by AMOV · Your Company. Always On.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const lightTheme = {
  ground: '#f6f7f9',
  paper: '#ffffff',
  ink: '#14161a',
  inkSoft: '#5b6270',
  line: '#e3e5ea',
};

const darkTheme = {
  ground: '#0e1013',
  paper: '#16181d',
  ink: '#f2f3f5',
  inkSoft: '#9aa1ae',
  line: '#2a2e36',
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 8 },
  wordmark: { fontSize: 13, fontWeight: '800', letterSpacing: 2, marginBottom: 20 },
  greeting: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  brief: { fontSize: 15, marginBottom: 20 },
  section: { fontSize: 12, letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 2, padding: 16, gap: 6 },
  cardTitle: { fontSize: 12, letterSpacing: 1, marginBottom: 4 },
  cardBody: { fontSize: 15, lineHeight: 22 },
  note: { fontSize: 12, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: 3 },
  floorNum: { width: 56, fontSize: 12, fontVariant: ['tabular-nums'] },
  floorName: { fontSize: 14, flexShrink: 1 },
  footer: { fontSize: 12, marginTop: 28, textAlign: 'center' },
});
