---
name: dlc-composition-patterns
description: >
  React and React Native composition patterns for flexible, maintainable
  components. Use when refactoring components with boolean-prop proliferation,
  building compound components, designing reusable component APIs, wiring
  context providers, deciding between render props and children, or composing
  HeroUI Native primitives. Covers React 19 use() and ref-as-prop, and HeroUI
  Native asChild slot composition. Triggers on compound components, asChild,
  boolean props, context provider, render props, component architecture.
metadata:
  author: chris@delacour.co.nz
  version: "0.1.0"
  category: frontend
  tags: [react, react-native, composition, compound-components, heroui-native, architecture]
license: UNLICENSED
---

# React & HeroUI Native Composition Patterns

Composition patterns for building flexible, maintainable React and React Native
components. Avoid boolean-prop proliferation by using compound components,
lifting state into providers, and composing internals. HeroUI Native is the
concrete component idiom (compound dot notation plus `asChild`), and these rules
are the architecture behind it. Following them keeps codebases easy for both
humans and AI agents to work with as they scale.

## When to Use

Reach for this skill when:

- Refactoring a component that has accumulated many boolean props (`isThread`, `isEditing`, `showFooter`).
- Building or extending a reusable component library.
- Designing a flexible component API and deciding between props, children, and render props.
- Reviewing component architecture in a PR.
- Working with compound components or context providers.
- Composing HeroUI Native primitives (`Dialog`, `Button`, `Popover`, `Card`) or wiring up `asChild`.

## Rules / Steps

Apply these in priority order. Architecture rules are HIGH impact because they
prevent whole classes of unmaintainable code.

| Priority | Category                | Impact | Prefix          |
| -------- | ----------------------- | ------ | --------------- |
| 1        | Component Architecture  | HIGH   | `architecture-` |
| 2        | State Management        | MEDIUM | `state-`        |
| 3        | Implementation Patterns | MEDIUM | `patterns-`     |
| 4        | React 19 APIs           | MEDIUM | `react19-`      |
| 5        | HeroUI Native           | MEDIUM | `heroui-`       |

### 1. Avoid boolean-prop proliferation (HIGH)

Do not add boolean props like `isThread`, `isEditing`, or `isDMThread` to
customize behavior. Each boolean doubles the number of possible states and
creates unmaintainable conditional logic (including impossible combinations).
Compose explicit variants instead. This is the same reasoning behind preferring
discriminated unions over stacked boolean flags for type-based shapes.

**Incorrect: boolean props create exponential complexity**

```tsx
function Composer({
  onSubmit,
  isThread,
  channelId,
  isDMThread,
  dmId,
  isEditing,
  isForwarding,
}: Props) {
  return (
    <form>
      <Header />
      <Input />
      {isDMThread ? (
        <AlsoSendToDMField id={dmId} />
      ) : isThread ? (
        <AlsoSendToChannelField id={channelId} />
      ) : null}
      {isEditing ? (
        <EditActions />
      ) : isForwarding ? (
        <ForwardActions />
      ) : (
        <DefaultActions />
      )}
      <Footer onSubmit={onSubmit} />
    </form>
  )
}
```

**Correct: composition eliminates the conditionals**

```tsx
// Channel composer
function ChannelComposer() {
  return (
    <Composer.Frame>
      <Composer.Header />
      <Composer.Input />
      <Composer.Footer>
        <Composer.Attachments />
        <Composer.Formatting />
        <Composer.Emojis />
        <Composer.Submit />
      </Composer.Footer>
    </Composer.Frame>
  )
}

// Thread composer - adds "also send to channel"
function ThreadComposer({ channelId }: { channelId: string }) {
  return (
    <Composer.Frame>
      <Composer.Header />
      <Composer.Input />
      <AlsoSendToChannelField id={channelId} />
      <Composer.Footer>
        <Composer.Formatting />
        <Composer.Emojis />
        <Composer.Submit />
      </Composer.Footer>
    </Composer.Frame>
  )
}
```

Each variant is explicit about what it renders. Internals are shared without a
single monolithic parent.

### 2. Use compound components with shared context (HIGH)

Structure a complex component as a set of subcomponents that read shared state
from context, not props. Consumers compose only the pieces they need, with no
prop drilling.

**Incorrect: monolithic component with render props and show flags**

```tsx
function Composer({
  renderHeader,
  renderFooter,
  showAttachments,
  showFormatting,
  showEmojis,
}: Props) {
  return (
    <form>
      {renderHeader?.()}
      <Input />
      {showAttachments && <Attachments />}
      {renderFooter ? (
        renderFooter()
      ) : (
        <Footer>
          {showFormatting && <Formatting />}
          {showEmojis && <Emojis />}
        </Footer>
      )}
    </form>
  )
}
```

**Correct: compound components with a shared context**

```tsx
const ComposerContext = createContext<ComposerContextValue | null>(null)

function ComposerProvider({ children, state, actions, meta }: ProviderProps) {
  return (
    <ComposerContext value={{ state, actions, meta }}>
      {children}
    </ComposerContext>
  )
}

function ComposerFrame({ children }: { children: React.ReactNode }) {
  return <form>{children}</form>
}

function ComposerInput() {
  const {
    state,
    actions: { update },
    meta: { inputRef },
  } = use(ComposerContext)
  return (
    <TextInput
      ref={inputRef}
      value={state.input}
      onChangeText={(text) => update((s) => ({ ...s, input: text }))}
    />
  )
}

function ComposerSubmit() {
  const {
    actions: { submit },
  } = use(ComposerContext)
  return <Button onPress={submit}>Send</Button>
}

// Export the pieces as one compound component object
const Composer = {
  Provider: ComposerProvider,
  Frame: ComposerFrame,
  Input: ComposerInput,
  Submit: ComposerSubmit,
  Header: ComposerHeader,
  Footer: ComposerFooter,
  Attachments: ComposerAttachments,
  Formatting: ComposerFormatting,
  Emojis: ComposerEmojis,
}
```

Usage:

```tsx
<Composer.Provider state={state} actions={actions} meta={meta}>
  <Composer.Frame>
    <Composer.Header />
    <Composer.Input />
    <Composer.Footer>
      <Composer.Formatting />
      <Composer.Submit />
    </Composer.Footer>
  </Composer.Frame>
</Composer.Provider>
```

Consumers compose exactly what they need. No hidden conditionals. State,
actions, and meta are injected by a parent provider, so the same structure works
for many use cases.

### 3. Decouple state from UI with a generic context interface (MEDIUM)

The provider is the only place that knows how state is managed. UI components
consume a generic interface with three parts: `state`, `actions`, and `meta`.
They never know whether the data comes from `useState`, a store, or a server
sync. This is dependency injection for component state.

**Incorrect: UI coupled to a specific state hook**

```tsx
function ComposerInput() {
  const { input, setInput } = useChannelComposerState()
  return <TextInput value={input} onChangeText={setInput} />
}
```

**Correct: a generic interface any provider can implement**

```tsx
interface ComposerState {
  input: string
  attachments: Attachment[]
  isSubmitting: boolean
}

interface ComposerActions {
  update: (updater: (state: ComposerState) => ComposerState) => void
  submit: () => void
}

interface ComposerMeta {
  inputRef: React.RefObject<TextInput>
}

interface ComposerContextValue {
  state: ComposerState
  actions: ComposerActions
  meta: ComposerMeta
}

const ComposerContext = createContext<ComposerContextValue | null>(null)

function ComposerInput() {
  const {
    state,
    actions: { update },
    meta,
  } = use(ComposerContext)
  // Works with ANY provider that implements the interface
  return (
    <TextInput
      ref={meta.inputRef}
      value={state.input}
      onChangeText={(text) => update((s) => ({ ...s, input: text }))}
    />
  )
}
```

Different providers implement the same interface, and the same composed UI works
with all of them:

```tsx
// Local state for an ephemeral form
function ForwardMessageProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialState)
  const inputRef = useRef(null)
  const submit = useForwardMessage()
  return (
    <ComposerContext value={{ state, actions: { update: setState, submit }, meta: { inputRef } }}>
      {children}
    </ComposerContext>
  )
}

// Global synced state for a channel
function ChannelProvider({ channelId, children }: Props) {
  const { state, update, submit } = useGlobalChannel(channelId)
  const inputRef = useRef(null)
  return (
    <ComposerContext value={{ state, actions: { update, submit }, meta: { inputRef } }}>
      {children}
    </ComposerContext>
  )
}
```

The UI is reusable bits you compose. The state is injected by the provider. Swap
the provider, keep the UI.

### 4. Lift state into provider components (MEDIUM)

Move state into a dedicated provider so sibling components outside the main UI
can read and update it without prop drilling, `useEffect` sync, or reading refs
on submit. The provider boundary is what matters, not the visual nesting.

**Incorrect: state trapped inside the component**

```tsx
function ForwardMessageDialog() {
  return (
    <Dialog>
      <ForwardMessageComposer />
      <MessagePreview /> {/* Needs composer state, but has no access */}
      <DialogActions>
        <CancelButton />
        <ForwardButton /> {/* Needs to call submit, but has no access */}
      </DialogActions>
    </Dialog>
  )
}
```

**Correct: state lifted to the provider**

```tsx
function ForwardMessageDialog() {
  return (
    <ForwardMessageProvider>
      <Dialog>
        <ForwardMessageComposer />
        <MessagePreview /> {/* Reads composer state */}
        <DialogActions>
          <CancelButton />
          <ForwardButton /> {/* Calls submit */}
        </DialogActions>
      </Dialog>
    </ForwardMessageProvider>
  )
}

// Lives OUTSIDE Composer.Frame, still inside the provider, so it can submit
function ForwardButton() {
  const { actions } = use(ComposerContext)
  return <Button onPress={actions.submit}>Forward</Button>
}

// Reads composer state from outside the frame too
function MessagePreview() {
  const { state } = use(ComposerContext)
  return <Preview message={state.input} attachments={state.attachments} />
}
```

Components that need shared state do not have to be visually nested inside each
other. They just need to be within the same provider.

### 5. Prefer explicit variants over boolean modes (MEDIUM)

Instead of one component driven by many boolean props, create explicit variant
components. Each variant composes the pieces it needs and documents itself.

**Incorrect: one component, many modes**

```tsx
// What does this actually render?
<Composer isThread isEditing={false} channelId="abc" showAttachments showFormatting={false} />
```

**Correct: explicit variants**

```tsx
<ThreadComposer channelId="abc" />
<EditMessageComposer messageId="xyz" />
<ForwardMessageComposer messageId="123" />
```

Each variant is explicit about its provider, its UI elements, and its available
actions. There are no boolean combinations to reason about and no impossible
states.

### 6. Prefer composing children over render props (MEDIUM)

Use `children` for composition instead of `renderX` props. Children read
naturally, compose without callback signatures, and keep the structure visible.

**Incorrect: render props for static structure**

```tsx
<Composer
  renderHeader={() => <CustomHeader />}
  renderFooter={() => (
    <>
      <Formatting />
      <Emojis />
    </>
  )}
/>
```

**Correct: compound components with children**

```tsx
<Composer.Frame>
  <CustomHeader />
  <Composer.Input />
  <Composer.Footer>
    <Composer.Formatting />
    <Composer.Emojis />
    <SubmitButton />
  </Composer.Footer>
</Composer.Frame>
```

Render props are still the right tool when the parent must pass data back to the
child. Use children for static structure, render props for data:

```tsx
<List data={items} renderItem={({ item, index }) => <Item item={item} index={index} />} />
```

### 7. React 19 APIs (MEDIUM, applies to this codebase)

This monorepo runs React 19, so use these directly. In React 19, `ref` is a
regular prop (no `forwardRef` wrapper) and `use()` replaces `useContext()`.
`use()` can also be called conditionally, unlike `useContext()`.

**Incorrect**

```tsx
const ComposerInput = forwardRef<TextInput, Props>((props, ref) => {
  const value = useContext(ComposerContext)
  return <TextInput ref={ref} {...props} />
})
```

**Correct**

```tsx
function ComposerInput({ ref, ...props }: Props & { ref?: React.Ref<TextInput> }) {
  const value = use(ComposerContext)
  return <TextInput ref={ref} {...props} />
}
```

### 8. HeroUI Native composition (MEDIUM)

HeroUI Native ships composition as a first-class API. Two idioms:

**Compound components via dot notation.** Sub-components are exported as
properties of the root and share context, so you assemble the parts you need:

```tsx
<Dialog>
  <Dialog.Trigger>Open Dialog</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      <Dialog.Close />
      <Dialog.Title>Dialog Title</Dialog.Title>
      <Dialog.Description>Dialog description</Dialog.Description>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog>
```

**`asChild` for slot composition.** With `asChild`, a component clones its child
and merges its props onto it instead of rendering its own default element. Use it
to make your own component the trigger, with no wrapper element:

```tsx
<Dialog.Trigger asChild>
  <Button variant="primary">Open Dialog</Button>
</Dialog.Trigger>
```

**Compose primitives into your own components.** Wrap the primitives to make
reusable pieces, for example a `PopoverButton` that combines `Popover` with a
`Button` trigger, or a `ProductCard` built from `Card` sub-components:

```tsx
function PopoverButton({ label, children }: PopoverButtonProps) {
  return (
    <Popover>
      <Popover.Trigger asChild>
        <Button>{label}</Button>
      </Popover.Trigger>
      <Popover.Content>{children}</Popover.Content>
    </Popover>
  )
}
```

**Custom variants with `tailwind-variants`.** Define separate variant systems for
the root and the label rather than reaching for boolean props. Note the gotcha
in Edge Cases: text-color classes belong on `Button.Label`, not the parent
`Button`.

## Rules / Steps: Edge Cases

- **`Button.Label` text color.** Apply text-color classes to `Button.Label`, not
  the parent `Button`. Styling the parent does not reliably reach the label, so
  the color is dropped or conflicts at the hierarchy level.
- **Render props are fine when data flows back.** The children-over-render-props
  rule is about static structure. When the parent produces data for the child
  (list rows, virtualized items), a `renderItem`-style prop is correct.
- **Provider boundary, not visual nesting.** A component can read shared state as
  long as it is inside the provider, even if it sits far from the UI it relates
  to. Do not force visual nesting to share state; lift state to a provider.

## Examples

### Example: a boolean-prop component becomes composed variants

**Before:**

```tsx
<Composer
  isThread
  isEditing={false}
  channelId="abc"
  showAttachments
  showFormatting={false}
/>
```

**After:**

```tsx
<ThreadProvider channelId="abc">
  <Composer.Frame>
    <Composer.Input />
    <AlsoSendToChannelField channelId="abc" />
    <Composer.Footer>
      <Composer.Emojis />
      <Composer.Submit />
    </Composer.Footer>
  </Composer.Frame>
</ThreadProvider>
```

The rendered structure is explicit, there are no impossible flag combinations,
and state is injected by the provider.

## References

1. [React: use()](https://react.dev/reference/react/use)
2. [React: Passing data deeply with context](https://react.dev/learn/passing-data-deeply-with-context)
3. [HeroUI Native: Composition](https://heroui.com/docs/native/getting-started/composition)
