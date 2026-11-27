import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Plus, RotateCcw, WandSparkles, X } from 'lucide-react-native';
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AiBubble, MeBubble, Mention, TypingBubble } from '@/components/chat/Bubbles';
import { Chip } from '@/components/chat/Chip';
import { Composer } from '@/components/chat/Composer';
import { MentionSheet } from '@/components/chat/MentionSheet';
import { GlowBackground } from '@/components/glow/GlowBackground';
import type { GlowBlob } from '@/components/glow/types';
import { IconButton } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { SlideView } from '@/components/SlideView';
import { TopBar } from '@/components/ui/TopBar';
import { useBrand } from '@/data/brand';
import {
  type Asset,
  type Client,
  coverTitle,
  type DeckType,
  deckTypes,
  findClient,
  MIN_DECK_PHOTOS,
  photoChoices,
  pickPhotos,
  slideChoices,
  SLIDES_MAX,
  SLIDES_MIN,
  SAMPLE_PHOTO,
  thumb,
  typedSlides,
  useClients,
} from '@/data/clients';
import { errorMessage } from '@/api/client';
import { showError } from '@/lib/confirm';
import { understand } from '@/services/assistant';
import { setPickHandler } from '@/data/photoPick';
import { createDeck } from '@/data/app';
import { rememberDetail } from '@/data/deckEdits';
import { firstName, useSession } from '@/data/session';
import { useSettings } from '@/data/settings';
import { getTemplate, type TemplateId, templates, useDefaultTemplate } from '@/data/templates';
import { haptic } from '@/hooks/haptics';
import { colors, glow, shadow } from '@/theme/tokens';
import { FadeEdges } from '@/components/FadeEdges';

const BLOBS: readonly GlowBlob[] = [
  { x: 0.55, y: 0.8, r: 0.66, color: glow.mid, opacity: 0.45, drift: 28 },
  { x: 0.05, y: -0.03, r: 0.4, color: glow.mist, drift: 22, phase: 0.5 },
];

type Msg =
  | { id: number; role: 'me'; text: string; mention?: Client }
  | { id: number; role: 'ai'; kind: 'greet' | 'needTag' | 'askSlides' | 'badSlides' }
  | { id: number; role: 'ai'; kind: 'say'; text: string }
  | { id: number; role: 'ai'; kind: 'askPhotos' | 'askTemplate'; client: Client }
  | { id: number; role: 'ai'; kind: 'review'; client: Client; slides: number; note?: string }
  | { id: number; role: 'ai'; kind: 'confirm'; client: Client; slides: number; deck: DeckType; photos: number; template: string };

/** Omit that keeps each variant of a union separate. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewMsg = DistributiveOmit<Msg, 'id'>;

type Stage = 'compose' | 'photos' | 'slides' | 'template' | 'review' | 'done';

const TYPING_MS = 900;
const MENTION_RE = /(?:^|\s)@([^@\n]{0,24})$/;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** "an 8-slide", "a 12-slide". */
const article = (n: number) => (/^(8|11|18)/.test(String(n)) ? 'an' : 'a');
/** A deck type named in the message ("make a proposal for…"), if any. */
const typeIn = (text: string) => deckTypes.find((t) => new RegExp(`\\b${t}`, 'i').test(text));

function asDeck(v: string | string[] | undefined): DeckType {
  const raw = Array.isArray(v) ? v[0] : v;
  return deckTypes.find((t) => t.toLowerCase() === (raw ?? '').toLowerCase()) ?? 'Portfolio';
}

/** 03 Tag a client + 04 AI asks — one live conversation. */
export default function Chat() {
  const params = useLocalSearchParams<{ client?: string; type?: string; focus?: string }>();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const nextId = useRef(2);

  const [deck, setDeck] = useState<DeckType>(() => asDeck(params.type));
  const clients = useClients();
  const [tagged, setTagged] = useState<Client | undefined>(() => (params.client ? findClient(params.client) : undefined));
  // Pre-filled text ends with a space so typing "@" straight away opens the client list.
  const [draft, setDraft] = useState(() => (params.client || params.type ? `Make a ${asDeck(params.type).toLowerCase()} for ` : ''));
  const [messages, setMessages] = useState<Msg[]>([{ id: 1, role: 'ai', kind: 'greet' }]);
  const [stage, setStage] = useState<Stage>('compose');
  const [typing, setTyping] = useState(false);
  const [subject, setSubject] = useState<Client | null>(null);
  const [photoPick, setPhotoPick] = useState<string | null>(null);
  const [slidePick, setSlidePick] = useState<string | null>(null);
  const [templatePick, setTemplatePick] = useState<TemplateId | null>(null);
  const defaultTemplate = useDefaultTemplate();
  // Review step: the photos proposed for the deck, and the ones the user took out.
  const [pool, setPool] = useState<Asset[]>([]);
  const [removed, setRemoved] = useState<Asset[]>([]);
  const { width: screenW } = useWindowDimensions();
  const brand = useBrand();
  const [focused, setFocused] = useState(false);
  const [builtDeckId, setBuiltDeckId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const { user, drive } = useSession();
  const { defaultSlides } = useSettings();

  // Never let a pending reply fire after the screen is gone.
  useEffect(() => {
    const set = timers.current;
    return () => {
      set.forEach(clearTimeout);
      set.clear();
    };
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  const push = useCallback((m: NewMsg) => {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { ...m, id } as Msg]);
  }, []);

  /** Shows the typing dots, then the assistant's message. */
  const reply = useCallback(
    (m: NewMsg, after?: () => void) => {
      setTyping(true);
      later(() => {
        setTyping(false);
        push(m);
        haptic.tap();
        after?.();
      }, TYPING_MS);
    },
    [later, push],
  );

  const mentionQuery = useMemo(() => {
    if (stage !== 'compose' && stage !== 'done') return null;
    const m = MENTION_RE.exec(draft);
    return m ? (m[1] ?? '').trim().toLowerCase() : null;
  }, [draft, stage]);

  const matches = useMemo(
    () => (mentionQuery === null ? [] : clients.filter((c) => c.name.toLowerCase().split(' ').some((w) => w.startsWith(mentionQuery)) || c.name.toLowerCase().startsWith(mentionQuery))),
    [mentionQuery, clients],
  );

  const pick = (c: Client) => {
    setTagged(c);
    const rest = draft.replace(MENTION_RE, '').trimEnd();
    setDraft(rest.length > 0 ? `${rest} ` : `Make a ${deck.toLowerCase()} for `);
  };

  const send = () => {
    if (typing) return;
    const text = draft.trim();
    // While a question is open, a typed message answers it.
    if (stage === 'slides') {
      if (!text) return;
      setDraft('');
      const n = typedSlides(text);
      if (n === null) {
        push({ role: 'me', text });
        reply({ role: 'ai', kind: 'badSlides' });
        return;
      }
      answerSlides(`${n} slides`);
      return;
    }
    if (stage === 'photos') {
      if (!text) return;
      setDraft('');
      answerPhotos(text);
      return;
    }
    // After a build, a new message starts a fresh conversation (the finished one is cleared).
    if (stage === 'done') {
      if (!text && !tagged) return;
      const client = tagged;
      reset();
      startRequest(text, client, asDeck(params.type));
      return;
    }
    if (stage !== 'compose') return;
    startRequest(text, tagged, deck);
  };

  /**
   * A typed request goes to the assistant first: it finds the client and any answers already given
   * ("a 10-slide proposal for Highrize, night shots, bold template"), and the chat skips those
   * questions. If the assistant can't be reached, the chat carries on the usual way.
   */
  const startRequest = (text: string, client: Client | undefined, baseType: DeckType) => {
    if (!text) return startScripted(text, client, baseType);
    push({ role: 'me', text, mention: client });
    setDraft('');
    setTyping(true);
    understand(text, client?.id)
      .then((u) => {
        setTyping(false);
        const who = (u.clientId ? findClient(u.clientId) : undefined) ?? client;
        if (!who) {
          reply({ role: 'ai', kind: u.source === 'ai' ? 'say' : 'needTag', text: u.reply } as NewMsg);
          return;
        }
        const type = u.deckType ?? typeIn(text) ?? baseType;
        setDeck(type);
        setTagged(undefined);
        setSubject(who);
        const slides = u.slides ? `${u.slides} slides` : null;
        if (u.photoChoice) setPhotoPick(u.photoChoice);
        if (slides) setSlidePick(slides);
        if (u.template) setTemplatePick(u.template);
        push({ role: 'ai', kind: 'say', text: u.reply });
        haptic.tap();
        if (!u.photoChoice) return reply({ role: 'ai', kind: 'askPhotos', client: who }, () => setStage('photos'));
        if (!slides) return reply({ role: 'ai', kind: 'askSlides' }, () => setStage('slides'));
        if (!u.template) return reply({ role: 'ai', kind: 'askTemplate', client: who }, () => setStage('template'));
        showReview(who, u.photoChoice, slides);
      })
      .catch(() => {
        setTyping(false);
        startScripted(text, client, baseType, true);
      });
  };

  /** The step-by-step flow (also the fallback when the assistant is unreachable). */
  const startScripted = (text: string, client: Client | undefined, baseType: DeckType, alreadyShown = false) => {
    if (!client) {
      if (!text) return;
      if (!alreadyShown) push({ role: 'me', text });
      setDraft('');
      reply({ role: 'ai', kind: 'needTag' });
      return;
    }
    // A deck type typed in the message wins over the one the chat was opened with.
    const type = typeIn(text) ?? baseType;
    setDeck(type);
    if (!alreadyShown) push({ role: 'me', text: text || `Make a ${type.toLowerCase()} for`, mention: client });
    setDraft('');
    setTagged(undefined);
    setSubject(client);
    reply({ role: 'ai', kind: 'askPhotos', client }, () => setStage('photos'));
  };

  const answerPhotos = (choice: string) => {
    if (stage !== 'photos' || typing) return;
    Keyboard.dismiss();
    setPhotoPick(choice);
    push({ role: 'me', text: choice });
    setStage('slides');
    reply({ role: 'ai', kind: 'askSlides' });
  };

  // Hand-picked photos come back from the photo picker while we're waiting on this question.
  const picked = useRef<Asset[] | null>(null);
  const answerRef = useRef(answerPhotos);
  useEffect(() => {
    answerRef.current = answerPhotos;
  });
  useEffect(() => {
    if (stage !== 'photos' || !subject) return;
    setPickHandler((photos) => {
      picked.current = photos;
      answerRef.current(`${photos.length} hand-picked ${photos.length === 1 ? 'photo' : 'photos'}`);
    });
    return () => setPickHandler(null);
  }, [stage, subject]);
  const openPicker = (clientId: string) => {
    if (stage !== 'photos' || typing) return;
    router.push({ pathname: '/photos', params: { client: clientId, mode: 'pick' } });
  };

  const answerSlides = (choice: string) => {
    if (stage !== 'slides' || typing || !subject) return;
    Keyboard.dismiss();
    setSlidePick(choice);
    push({ role: 'me', text: choice });
    setStage('template');
    reply({ role: 'ai', kind: 'askTemplate', client: subject });
  };

  const answerTemplate = (id: TemplateId) => {
    if (stage !== 'template' || typing || !subject || !slidePick) return;
    setTemplatePick(id);
    push({ role: 'me', text: `${getTemplate(id).name} template` });
    showReview(subject, photoPick, slidePick);
  };

  /** Shows the photos that will go into the deck, so the user can take out any they don't like. */
  const showReview = (client: Client, photoChoice: string | null, slides: string) => {
    setStage('review');
    const handPicked = photoChoice?.includes('hand-picked') && picked.current?.length ? picked.current : null;
    const pick = handPicked ? { photos: handPicked, note: undefined } : pickPhotos(client, photoChoice ?? 'Best of everything');
    setPool(pick.photos);
    setRemoved([]);
    reply({ role: 'ai', kind: 'review', client, slides: Number.parseInt(slides, 10) || 12, note: pick.note });
  };

  const kept = pool.filter((a) => !removed.includes(a));
  const removePhoto = (a: Asset) => {
    if (stage !== 'review' || kept.length <= MIN_DECK_PHOTOS) return;
    haptic.tap();
    setRemoved((r) => [...r, a]);
  };
  const restorePhoto = (a: Asset) => {
    if (stage !== 'review') return;
    haptic.select();
    setRemoved((r) => r.filter((x) => x !== a));
  };

  const build = async () => {
    if (building || stage !== 'review' || typing || !subject || !slidePick || !templatePick || kept.length < MIN_DECK_PHOTOS) return;
    const slides = Number.parseInt(slidePick, 10) || 12;
    // Every build is a new deck (it never replaces another one). The kept photos become its slides.
    setBuilding(true);
    let created;
    try {
      created = await createDeck({
        clientId: subject.id,
        type: deck,
        slides,
        title: coverTitle(subject, deck),
        photoIds: kept.map((a) => a.id),
        template: templatePick,
      });
      rememberDetail(created);
    } catch (e) {
      showError('Couldn’t build the deck', errorMessage(e));
      haptic.warn();
      return;
    } finally {
      setBuilding(false);
    }
    setBuiltDeckId(created.id);
    push({ role: 'me', text: removed.length ? `Use these ${plural(kept.length, 'photo')}` : 'Looks good, build it' });
    setStage('done');
    reply({ role: 'ai', kind: 'confirm', client: subject, slides, deck, photos: Math.min(kept.length, slides), template: getTemplate(templatePick).name }, () => {
      later(() => {
        haptic.success();
        router.push({ pathname: '/creating', params: { deck: created.id } });
      }, 1200);
    });
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setMessages([{ id: nextId.current++, role: 'ai', kind: 'greet' }]);
    setStage('compose');
    setTyping(false);
    setSubject(null);
    setPhotoPick(null);
    picked.current = null;
    setSlidePick(null);
    setTemplatePick(null);
    setPool([]);
    setRemoved([]);
    setBuiltDeckId(null);
    setBuilding(false);
    setDeck(asDeck(params.type));
    setTagged(undefined);
    setDraft('');
  };

  const suggest = (type: DeckType, clientId: string) => {
    setDeck(type);
    setTagged(findClient(clientId));
    setDraft(`Make a ${type.toLowerCase()} for `);
  };

  const showSuggestions = stage === 'compose' && messages.length === 1 && !typing && mentionQuery === null;
  const question = stage === 'photos' ? 1 : stage === 'slides' ? 2 : stage === 'template' ? 3 : 0;

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      <GlowBackground blobs={BLOBS} />
      {/* 'padding' on both platforms: with Android edge-to-edge the window no longer resizes for the keyboard. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View className="px-5" style={{ paddingTop: insets.top + 10 }}>
          <TopBar
            title="DriveFlow AI"
            subtitle={drive.folderId ? 'Drive synced' : undefined}
            right={<IconButton icon={Plus} label="New chat" tint={colors.brand} onPress={reset} />}
          />
        </View>

        <FadeEdges start={18} end={22}>
        <ScrollView
          ref={scroller}
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) => {
            if (m.role === 'me') {
              return (
                <MeBubble key={m.id}>
                  {m.text}
                  {m.mention && (
                    <>
                      {' '}
                      <Mention name={m.mention.name} onDark />
                    </>
                  )}
                </MeBubble>
              );
            }
            switch (m.kind) {
              case 'greet':
                return (
                  <AiBubble key={m.id}>
                    Hi {firstName(user) || 'there'}. Who are we creating for today? Tell me what you need, or type <Text className="font-jk-semibold text-brand-deep">@</Text> to tag a client.
                  </AiBubble>
                );
              case 'badSlides':
                return (
                  <AiBubble key={m.id}>
                    Please type a number from {SLIDES_MIN} to {SLIDES_MAX}, or pick one of the suggestions above.
                  </AiBubble>
                );
              case 'say':
                return <AiBubble key={m.id}>{m.text}</AiBubble>;
              case 'needTag':
                return (
                  <AiBubble key={m.id}>
                    Tag a client with <Text className="font-jk-semibold text-brand-deep">@</Text> first, so I know which Drive folder to use.
                  </AiBubble>
                );
              case 'askPhotos':
                return (
                  <View key={m.id} className="gap-3">
                    <AiBubble
                      extra={
                        <View className="mt-3.5 flex-row flex-wrap gap-2">
                          {m.client.gallery.slice(0, 3).map((src, i) => (
                            <Animated.View key={i}>
                              <Image source={thumb(src)} style={{ width: 56, height: 56, borderRadius: 14 }} contentFit="cover" accessible={false} />
                            </Animated.View>
                          ))}
                          <PressableScale
                            onPress={() => openPicker(m.client.id)}
                            disabled={stage !== 'photos'}
                            accessibilityLabel={`See all ${m.client.photos} photos and choose`}
                            style={{ width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }}
                          >
                            <Text className="font-jk-semibold text-[14px] text-white">+{Math.max(0, m.client.photos - 3)}</Text>
                          </PressableScale>
                        </View>
                      }
                    >
                      I found <Text className="font-jk-semibold text-brand-deep">{m.client.photos} {m.client.photos === 1 ? 'photo' : 'photos'}</Text> in {drive.folder ?? 'Projects'} / {m.client.name}. Which ones should I use?
                    </AiBubble>
                    <Text className="ml-11 font-jk text-[13px] text-muted">Pick one, or describe what you want below</Text>
                    <View className="ml-11 flex-row flex-wrap gap-2">
                      {photoChoices.map((c) => (
                        <Chip key={c} label={c} selected={photoPick === c} disabled={stage !== 'photos'} onPress={() => answerPhotos(c)} />
                      ))}
                      <Chip
                        label="Choose photos…"
                        selected={!!photoPick && photoPick.includes('hand-picked')}
                        disabled={stage !== 'photos'}
                        onPress={() => openPicker(m.client.id)}
                      />
                    </View>
                  </View>
                );
              case 'askSlides':
                return (
                  <View key={m.id} className="gap-3">
                    <AiBubble>How many slides should it be?</AiBubble>
                    <Text className="ml-11 font-jk text-[13px] text-muted">
                      Recommended, or type any number from {SLIDES_MIN} to {SLIDES_MAX}. Your default is {defaultSlides}.
                    </Text>
                    <View className="ml-11 flex-row flex-wrap gap-2">
                      {slideChoices.map((c) => (
                        <Chip key={c} label={c} selected={slidePick === c} disabled={stage !== 'slides'} onPress={() => answerSlides(c)} />
                      ))}
                    </View>
                  </View>
                );
              case 'askTemplate':
                return (
                  <View key={m.id} className="gap-3">
                    <AiBubble>Which template should I use?</AiBubble>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginHorizontal: -20 }}
                      contentContainerStyle={{ gap: 10, paddingLeft: 64, paddingRight: 20 }}
                      accessibilityRole="radiogroup"
                    >
                      {templates.map((t) => {
                        const on = templatePick === t.id;
                        const locked = stage !== 'template';
                        return (
                          <Pressable
                            key={t.id}
                            onPress={() => answerTemplate(t.id)}
                            disabled={locked}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: on, disabled: locked }}
                            accessibilityLabel={`${t.name} template. ${t.blurb}`}
                          >
                            <View style={{ width: 152, opacity: locked && !on ? 0.45 : 1 }}>
                              <View style={{ borderRadius: 16, borderWidth: 2, borderColor: on ? colors.brand : 'transparent', padding: 2, boxShadow: shadow.soft }}>
                                <SlideView
                                  template={t.id}
                                  source={m.client.cover ?? SAMPLE_PHOTO}
                                  title={coverTitle(m.client, deck)}
                                  eyebrow={m.client.name}
                                  index={0}
                                  brand={brand.on ? { name: brand.name, accent: brand.accent } : null}
                                  width={144}
                                  radius={12}
                                  titleLines={1}
                                />
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 4 }}>
                                <Text className={`font-jk-semibold text-[13px] ${on ? 'text-brand-deep' : 'text-ink'}`}>{t.name}</Text>
                                {t.id === defaultTemplate ? <Text className="font-jk text-[11px] text-muted">default</Text> : null}
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              case 'review': {
                const active = stage === 'review';
                const tile = Math.floor((screenW - 40 - 44 - 20 - 16) / 3);
                const used = Math.min(kept.length, m.slides);
                const tooFew = kept.length < MIN_DECK_PHOTOS;
                return (
                  <View key={m.id} className="gap-3">
                    <AiBubble>
                      {kept.length > m.slides ? (
                        <>
                          Here are the photos I picked. Your {m.slides} slides use the first <Text className="font-jk-semibold text-brand-deep">{m.slides}</Text> of these{' '}
                          {kept.length}.
                        </>
                      ) : (
                        <>
                          Here {kept.length === 1 ? 'is the' : 'are the'} <Text className="font-jk-semibold text-brand-deep">{plural(kept.length, 'photo')}</Text> I’ll use for your {m.slides} slides.
                        </>
                      )}
                      {active ? ' Tap × on any you don’t like.' : ''}
                      {m.note ? ` ${m.note}` : ''}
                    </AiBubble>
                    <View style={{ marginLeft: 44, borderRadius: 22, padding: 10, backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: shadow.soft }}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {kept.map((src, i) => (
                          <View key={src.id} style={{ width: tile, height: tile, borderRadius: 14, overflow: 'hidden' }}>
                            <Image source={thumb(src)} style={{ width: '100%', height: '100%' }} contentFit="cover" accessible={false} />
                            <View style={{ position: 'absolute', left: 6, top: 6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18,21,42,0.55)' }}>
                              <Text className="font-jk-bold text-[11px] text-white">{i + 1}</Text>
                            </View>
                            {active && kept.length > MIN_DECK_PHOTOS ? (
                              <Pressable onPress={() => removePhoto(src)} hitSlop={9} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} style={{ position: 'absolute', right: 5, top: 5 }}>
                                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, boxShadow: shadow.soft }}>
                                  <X size={15} color={colors.danger} strokeWidth={2.6} />
                                </View>
                              </Pressable>
                            ) : null}
                          </View>
                        ))}
                      </View>
                      {removed.length > 0 ? (
                        <View style={{ marginTop: 12 }}>
                          <Text className="font-jk text-[12px] text-muted">{active ? 'Removed · tap to put back' : 'Removed'}</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                            {removed.map((src, i) => (
                              <Pressable key={src.id} onPress={() => restorePhoto(src)} disabled={!active} accessibilityRole="button" accessibilityLabel={`Put back removed photo ${i + 1}`}>
                                <View style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden' }}>
                                  <Image source={thumb(src)} style={{ width: '100%', height: '100%', opacity: 0.45 }} contentFit="cover" accessible={false} />
                                  {active ? (
                                    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                                      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
                                        <RotateCcw size={14} color={colors.brand} strokeWidth={2.4} />
                                      </View>
                                    </View>
                                  ) : null}
                                </View>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      ) : null}
                      <Text className="mt-3 px-1 font-jk text-[12px] text-muted">
                        {active && tooFew
                          ? `A deck needs at least ${MIN_DECK_PHOTOS} photos. Tap + for a new chat and choose more.`
                          : active && kept.length <= MIN_DECK_PHOTOS
                            ? `${m.slides} slides from ${plural(used, 'photo')}. A deck needs at least ${MIN_DECK_PHOTOS}.`
                            : `${m.slides} slides from ${plural(used, 'photo')}`}
                      </Text>
                    </View>
                    {active ? (
                      <PressableScale
                        onPress={build}
                        disabled={tooFew || building}
                        feedback="press"
                        accessibilityLabel={`Build deck with ${plural(used, 'photo')}`}
                        containerStyle={{ alignSelf: 'flex-start', marginLeft: 44 }}
                        style={{ height: 46, paddingHorizontal: 20, borderRadius: 23, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brand, boxShadow: shadow.brand, opacity: tooFew ? 0.45 : 1 }}
                      >
                        <WandSparkles size={17} color={colors.white} strokeWidth={2} />
                        <Text className="font-jk-semibold text-[15px] text-white">{building ? 'Building…' : 'Build deck'}</Text>
                      </PressableScale>
                    ) : null}
                  </View>
                );
              }
              case 'confirm':
                return (
                  <View key={m.id} className="gap-3">
                    <AiBubble>
                      Perfect. Making {article(m.slides)} {m.slides}-slide {m.deck.toLowerCase()} for {m.client.name} from {plural(m.photos, 'photo')}, in the {m.template} template.
                    </AiBubble>
                    {stage === 'done' && builtDeckId && !typing ? (
                      <PressableScale
                        onPress={() => router.push({ pathname: '/ready', params: { deck: builtDeckId } })}
                        accessibilityLabel="Open the deck"
                        containerStyle={{ alignSelf: 'flex-start', marginLeft: 44 }}
                        style={{ height: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.edge }}
                      >
                        <Text className="font-jk-semibold text-[14px] text-brand-deep">Open deck</Text>
                      </PressableScale>
                    ) : null}
                  </View>
                );
              default:
                return null;
            }
          })}

          {typing && <TypingBubble />}

          {showSuggestions && (
            <View className="mt-2 gap-2">
              <Text className="font-jk text-[13px] text-muted">Try asking</Text>
              {clients.slice(0, 2).map((c, i) => ({ type: (i === 0 ? 'Portfolio' : 'Proposal') as DeckType, id: c.id, name: c.name })).map((s) => (
                <PressableScale
                  key={s.id}
                  onPress={() => suggest(s.type, s.id)}
                  feedback="select"
                  scaleTo={0.97}
                  accessibilityLabel={`${s.type} for ${s.name}`}
                  containerStyle={{ alignSelf: 'flex-start' }}
                  className="h-10 flex-row items-center rounded-full border-[1.5px] border-[#E1E5FF] bg-card px-4"
                >
                  <Text className="font-jk-semibold text-[14px] text-ink-soft">
                    {s.type} for <Text className="text-brand-deep">@{s.name}</Text>
                  </Text>
                </PressableScale>
              ))}
            </View>
          )}
        </ScrollView>
        </FadeEdges>

        <View className="gap-2.5 px-4" style={{ paddingBottom: insets.bottom + 14 }}>
          {mentionQuery !== null && <MentionSheet matches={matches} highlightId={tagged?.id} onPick={pick} />}

          {(question > 0 || stage === 'review') && (
            <View
              className="h-[60px] flex-row items-center gap-3.5 rounded-[22px] border border-white bg-white/75 px-4"
              style={{ boxShadow: shadow.soft }}
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-sky">
                <WandSparkles size={19} color={colors.brand} strokeWidth={1.8} />
              </View>
              <View className="flex-1">
                <Text className="font-jk-semibold text-[14px] text-ink">{stage === 'review' ? 'Last step: check the photos' : `Question ${question} of 3`}</Text>
                <Text className="font-jk text-[12px] text-muted">
                  {stage === 'review' ? 'Remove any you don’t like, then build' : question === 1 ? 'Next: how many slides?' : question === 2 ? 'Next: pick a template' : 'Next: check the photos'}
                </Text>
              </View>
              <View className="flex-row gap-1.5">
                {[1, 2, 3].map((n) => (
                  <View key={n} style={{ height: 6, width: 18, borderRadius: 3, backgroundColor: question >= n || stage === 'review' ? colors.brand : colors.edge }} />
                ))}
              </View>
            </View>
          )}

          <Composer
            value={draft}
            onChangeText={setDraft}
            onSend={send}
            tagged={tagged}
            onClearTag={() => setTagged(undefined)}
            focused={focused}
            editable={(stage === 'compose' || stage === 'photos' || stage === 'slides' || stage === 'done') && !typing}
            placeholder={
              stage === 'compose'
                ? undefined
                : stage === 'photos'
                  ? 'Or describe them, e.g. pool and garden'
                  : stage === 'slides'
                    ? `Or type a number (${SLIDES_MIN}–${SLIDES_MAX})`
                    : stage === 'done'
                      ? 'Start another deck: type @ to tag a client'
                      : 'Pick an answer above'
            }
            keyboardType={stage === 'slides' ? 'number-pad' : 'default'}
            autoFocus={params.focus === '1'}
            onFocusChange={setFocused}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
