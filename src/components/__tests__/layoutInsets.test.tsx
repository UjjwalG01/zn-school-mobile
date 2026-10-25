import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { gutter, spacing } from '../../theme/tokens';
import { Banner } from '../Banner';
import { ListScreen } from '../ListScreen';
import { Screen } from '../Screen';
import { SegmentedControl } from '../SegmentedControl';
import { Text } from '../Text';

type Element = ReturnType<typeof screen.getByText>;

/**
 * The flattened `style` and `contentContainerStyle` of every ancestor of an element: the container that insets the
 * content is one of them (a ScrollView keeps its content style as a prop on its host view).
 */
function ancestorStyles(element: Element): Record<string, unknown>[] {
  const styles: Record<string, unknown>[] = [];
  for (let node: Element | null = element.parent; node; node = node.parent) {
    for (const style of [node.props.style, node.props.contentContainerStyle]) {
      const flat = StyleSheet.flatten(style);
      if (flat) styles.push(flat as Record<string, unknown>);
    }
  }
  return styles;
}

// The shared app shell sets the page insets once. Page content must have the gutter at both sides (it once lost it when
// `padding` was split into vertical-only values), and no screen adds a margin of its own at the edges.
describe('page insets', () => {
  it('Screen puts the gutter at the sides and the page spacing above and below', async () => {
    await render(
      <Screen>
        <Text>Hello</Text>
      </Screen>,
    );
    expect(ancestorStyles(screen.getByText('Hello'))).toContainEqual(
      expect.objectContaining({ paddingHorizontal: gutter, paddingVertical: spacing.lg }),
    );
  });

  it('ListScreen puts the same gutter around the list and its footer', async () => {
    await render(
      <ListScreen
        sections={[{ data: ['row'] }]}
        keyExtractor={(row) => row}
        renderItem={({ item }) => <Text>{item}</Text>}
        footer={<Text>Footer</Text>}
      />,
    );
    expect(ancestorStyles(screen.getByText('row'))).toContainEqual(
      expect.objectContaining({ paddingHorizontal: gutter, paddingVertical: spacing.lg }),
    );
    expect(ancestorStyles(screen.getByText('Footer'))).toContainEqual(
      expect.objectContaining({ paddingHorizontal: gutter }),
    );
  });

  it('a page can still adjust the list container (its own style is applied last)', async () => {
    await render(
      <ListScreen
        sections={[{ data: ['row'] }]}
        keyExtractor={(row) => row}
        renderItem={({ item }) => <Text>{item}</Text>}
        contentContainerStyle={{ paddingBottom: 0 }}
      />,
    );
    expect(ancestorStyles(screen.getByText('row'))).toContainEqual(
      expect.objectContaining({ paddingHorizontal: gutter, paddingBottom: 0 }),
    );
  });

  it('keeps room inside a banner and a segmented control so text never touches the border', async () => {
    await render(
      <>
        <Banner tone="info">A note</Banner>
        <SegmentedControl
          accessibilityLabel="Subtabs"
          value="a"
          onChange={() => undefined}
          options={[
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ]}
        />
      </>,
    );
    expect(ancestorStyles(screen.getByText('A note'))).toContainEqual(
      expect.objectContaining({ paddingHorizontal: spacing.md, paddingVertical: spacing.md }),
    );
    expect(StyleSheet.flatten(screen.getByLabelText('Subtabs').props.style)).toMatchObject({
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
    });
  });
});
