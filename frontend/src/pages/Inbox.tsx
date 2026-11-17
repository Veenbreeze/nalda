import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CircleDot, Info, MessageCircle, Search, Send } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import type { ApiResponse, Conversation, Message, Paginated } from '../types';
import { formatDate, timeAgo } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, PageLoader, Select } from '../components/ui';

interface ConversationDetail extends Conversation {
  messages: Message[];
}

export function InboxPage() {
  const { tr, enumLabel } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: config } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ configured: boolean; mode: string }>>('/whatsapp/config-status');
      return res.data.data;
    },
  });

  const { data: inbox, isLoading } = useQuery({
    queryKey: ['whatsapp-inbox', { search, unreadOnly }],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Conversation[]> & Paginated<Conversation>>('/whatsapp/inbox', {
        params: { limit: 50, search: search || undefined, unreadOnly: unreadOnly || undefined },
      });
      return res.data;
    },
    refetchInterval: 20_000,
  });

  const conversations = inbox?.data ?? [];

  useEffect(() => {
    if (!selectedId && conversations.length > 0) setSelectedId(conversations[0].id);
  }, [conversations, selectedId]);

  const { data: conversation, isLoading: loadingConversation } = useQuery({
    queryKey: ['whatsapp-conversation', selectedId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ConversationDetail>>(`/whatsapp/conversations/${selectedId}`);
      return res.data.data;
    },
    enabled: Boolean(selectedId),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (selectedId) {
      api.post(`/whatsapp/conversations/${selectedId}/read`).then(() => {
        void queryClient.invalidateQueries({ queryKey: ['whatsapp-inbox'] });
      }).catch(() => undefined);
    }
  }, [selectedId, queryClient]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages?.length]);

  const sendMessage = useMutation({
    mutationFn: async () => api.post(`/whatsapp/conversations/${selectedId}/messages`, { body: message }),
    onSuccess: () => {
      toast.success(tr('Message sent', 'Ujumbe umetumwa'));
      setMessage('');
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation', selectedId] });
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-inbox'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => api.patch(`/whatsapp/conversations/${selectedId}/status`, { status }),
    onSuccess: () => {
      toast.success(tr('Conversation updated', 'Mazungumzo yamesasishwa'));
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation', selectedId] });
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-inbox'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tr('WhatsApp inbox', 'Kikasha cha WhatsApp')}
        subtitle={tr(
          'Respond quickly, convert conversations into reviewed orders and keep every customer warm.',
          'Jibu haraka, geuza mazungumzo kuwa maagizo yaliyopitiwa na uendelee kuwa karibu na kila mteja.',
        )}
        actions={
          <Badge tone={config?.configured ? 'green' : 'amber'}>
            <CircleDot className="h-3 w-3" /> {config?.configured ? tr('Live connection', 'Muunganisho hai') : tr('Dry-run mode', 'Hali ya majaribio')}
          </Badge>
        }
      />

      {!config?.configured && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {tr(
              'WhatsApp Cloud API credentials are not configured. Outbound messages are simulated and no real message is sent. Add ',
              'Vitambulisho vya WhatsApp Cloud API havijasanidiwa. Ujumbe unaotoka unaigwa na hakuna ujumbe halisi unaotumwa. Ongeza ',
            )}
            <span className="font-semibold">WHATSAPP_ACCESS_TOKEN</span>
            {tr(' and ', ' na ')}
            <span className="font-semibold">WHATSAPP_PHONE_NUMBER_ID</span>
            {tr(' to enable live messaging.', ' ili kuwezesha utumaji wa ujumbe hai.')}
          </p>
        </div>
      )}

      <Card className="flex h-[calc(100vh-220px)] min-h-[520px] overflow-hidden">
        <div className="flex w-full flex-col border-r border-ink-100 sm:w-80 lg:w-96">
          <div className="border-b border-ink-100 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('Search conversations…', 'Tafuta mazungumzo…')}
                className="input-base pl-9"
              />
            </div>
            <label className="mt-2 flex items-center gap-2 px-1 text-[11px] font-medium text-ink-500">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
              />
              {tr('Unread only', 'Haijasomwa pekee')}
            </label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <PageLoader label={tr('Loading inbox…', 'Inapakia kikasha…')} />
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={<MessageCircle className="h-6 w-6" />}
                title={tr('Inbox is clear', 'Kikasha kiko wazi')}
                description={tr('New WhatsApp conversations will appear here.', 'Mazungumzo mapya ya WhatsApp yataonekana hapa.')}
              />
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-start gap-3 border-b border-ink-50 px-3 py-3 text-left transition ${
                    selectedId === c.id ? 'bg-gold-50/70' : 'hover:bg-ink-50/60'
                  }`}
                >
                  <Avatar name={c.customer?.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-ink-900">{c.customer?.fullName ?? c.whatsappPhone}</p>
                      <span className="shrink-0 text-[10px] text-ink-400">{timeAgo(c.lastMessageAt)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-400">{c.lastMessagePreview || tr('No messages yet', 'Hakuna ujumbe bado')}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge tone={c.status === 'OPEN' ? 'green' : c.status === 'PENDING' ? 'amber' : 'gray'}>{enumLabel(c.status)}</Badge>
                      {c.unreadCount > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[9px] font-bold text-ink-900">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="hidden flex-1 flex-col sm:flex">
          {!selectedId ? (
            <EmptyState
              icon={<MessageCircle className="h-6 w-6" />}
              title={tr('Select a conversation', 'Chagua mazungumzo')}
              description={tr('Choose a conversation to read and reply.', 'Chagua mazungumzo ili kusoma na kujibu.')}
            />
          ) : loadingConversation ? (
            <PageLoader label={tr('Loading messages…', 'Inapakia ujumbe…')} />
          ) : conversation ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={conversation.customer?.fullName} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{conversation.customer?.fullName ?? conversation.whatsappPhone}</p>
                    <p className="text-[10px] text-ink-400">{conversation.whatsappPhone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/customers/${conversation.customerId}`}
                    className="hidden rounded-lg border border-ink-200 px-2.5 py-1.5 text-[11px] font-semibold text-ink-600 hover:bg-ink-50 md:block"
                  >
                    {tr('Customer profile', 'Wasifu wa mteja')}
                  </Link>
                  <Select
                    value={conversation.status}
                    onChange={(e) => setStatus.mutate(e.target.value)}
                    className="w-32 text-xs"
                  >
                    <option value="OPEN">{enumLabel('OPEN')}</option>
                    <option value="PENDING">{enumLabel('PENDING')}</option>
                    <option value="CLOSED">{enumLabel('CLOSED')}</option>
                    <option value="ARCHIVED">{enumLabel('ARCHIVED')}</option>
                  </Select>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-cream/60 px-4 py-4">
                {conversation.messages.length === 0 && (
                  <p className="text-center text-xs text-ink-400">{tr('No messages in this conversation yet.', 'Hakuna ujumbe katika mazungumzo haya bado.')}</p>
                )}
                {conversation.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                        m.direction === 'OUTBOUND'
                          ? 'rounded-br-md bg-ink-900 text-white'
                          : 'rounded-bl-md border border-ink-100 bg-white text-ink-800'
                      }`}
                    >
                      {m.direction === 'OUTBOUND' && m.sentByAdmin && (
                        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-gold-400">{m.sentByAdmin.fullName}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{m.body || `[${enumLabel(m.type)}]`}</p>
                      <p className={`mt-1 text-right text-[9px] ${m.direction === 'OUTBOUND' ? 'text-ink-400' : 'text-ink-400'}`}>
                        {formatDate(m.createdAt, true)} · {enumLabel(m.status)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <form
                className="flex items-end gap-2 border-t border-ink-100 bg-white px-3 py-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (message.trim()) sendMessage.mutate();
                }}
              >
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (message.trim()) sendMessage.mutate();
                    }
                  }}
                  rows={1}
                  placeholder={tr(
                    'Write a reply… (Enter to send, Shift+Enter for new line)',
                    'Andika jibu… (Enter kutuma, Shift+Enter kwa mstari mpya)',
                  )}
                  className="input-base min-h-[42px] max-h-32 flex-1 resize-none py-2.5"
                />
                <Button type="submit" loading={sendMessage.isPending} disabled={!message.trim()} leftIcon={<Send className="h-4 w-4" />}>
                  {tr('Send', 'Tuma')}
                </Button>
              </form>
            </>
          ) : (
            <EmptyState title={tr('Conversation unavailable', 'Mazungumzo hayapatikani')} />
          )}
        </div>
      </Card>
    </div>
  );
}
