# Bulgarian UI glossary (authoritative — use verbatim)

The whole app UI must be **Bulgarian** (owner requirement, run 3). No i18n catalog —
hardcode Bulgarian strings directly (i18n infra stays out of scope, N19). Translate ONLY
user-facing text: JSX text, `label`/`placeholder`/`title`/`aria-label`/`alt`, headings,
button text, toasts, empty/loading states, table headers, nav, tab labels. **Do NOT change**
identifiers, imports, object keys, enum values, SWR keys, URL params, `data-*`, test text, or
code comments. Accountant-native terms preferred (счетоводителят чете това).

## Core documents
| EN | BG |
|---|---|
| Invoice | Фактура |
| Proforma (invoice) | Проформа фактура |
| Credit note | Кредитно известие |
| Debit note | Дебитно известие |
| Document / Document type | Документ / Вид документ |
| Received invoice(s) | Получени фактури |
| Number | Номер |
| Series | Серия |

## Lifecycle / actions
| EN | BG |
|---|---|
| Draft | Чернова |
| Finalize / Issue / Finalize (issue) | Издай |
| Save draft | Запази чернова |
| Cancel (an invoice) | Анулирай |
| Reinstate (uncancel) | Възстанови |
| Delete | Изтрий |
| Edit | Редактирай |
| Confirm | Потвърди |
| Discard | Отхвърли |
| Review / Review draft | Прегледай |
| Convert to invoice | Преобразувай във фактура |
| Copy | Копирай |
| Create credit note | Създай кредитно известие |
| Create debit note | Създай дебитно известие |
| Retry / Retry analysis | Опитай отново |
| Upload / Upload invoices | Качи / Качи фактури |
| Open / Open original file | Отвори / Отвори оригинала |
| Print / Print & Preview | Печат |
| Restore to draft | Върни в чернови |
| Save / Save changes | Запази / Запази промените |
| Add / Add line | Добави / Добави ред |
| Remove | Премахни |
| Archive / Unarchive | Архивирай / Разархивирай |
| Search | Търсене |
| Back | Назад |

## Statuses
| EN | BG |
|---|---|
| Analyzing… | Анализира се… |
| Failed | Неуспешно |
| Draft | Чернова |
| Finalized | Издадена |
| Cancelled | Анулирана |
| Confirmed | Потвърдена |
| Discarded | Отхвърлена |
| Paid | Платена |
| Unpaid | Неплатена |
| Partial | Частично |
| Overdue | Просрочена |
| Accounted | Осчетоводена |
| Pending / Pending review | Предстои / За преглед |

## Money / dashboard
| EN | BG |
|---|---|
| Revenue | Приходи |
| Outstanding (receivable) | Вземания |
| Expenses | Разходи |
| Expenses Paid | Платени разходи |
| Expenses Outstanding | Задължения |
| Overdue | Просрочени |
| Total | Общо |
| Tax base (net) | Данъчна основа |
| VAT / VAT rate | ДДС / ДДС ставка |
| Net / for НАП | Нето за НАП |
| Currency / Company currency | Валута / Валута на фирмата |
| Amount / Amount to pay | Сума / Сума за плащане |
| To pay / Paid this month | За плащане / Платени този месец |
| This month / Last 12 months | Този месец / Последните 12 месеца |

## Parties / catalog
| EN | BG |
|---|---|
| Partners | Контрагенти |
| Partner / Client / Recipient | Контрагент / Клиент / Получател |
| Supplier | Доставчик |
| Articles | Артикули |
| Article / Product / Service | Артикул / Стока / Услуга |
| Legal name | Наименование |
| EIK / UIC | ЕИК |
| VAT number | ДДС номер |
| Individual | Физическо лице |
| Country / City / Street / Post code | Държава / Град / Улица / Пощенски код |
| MOL (representative) | МОЛ |
| Bank name / IBAN / BIC | Банка / IBAN / BIC |

## Dates / payment
| EN | BG |
|---|---|
| Issue date | Дата на издаване |
| Tax event / Supply date | Дата на данъчно събитие |
| Due date | Падеж |
| Date | Дата |
| Payment method | Начин на плащане |
| Bank / Cash / Barter | Банков път / В брой / Бартер |
| Payment status | Статус на плащане |

## Navigation / structure / account
| EN | BG |
|---|---|
| Dashboard | Табло |
| Invoices | Фактури |
| ДДС / VAT | ДДС |
| Payments | Плащания |
| Partners | Контрагенти |
| Articles | Артикули |
| Company | Фирма |
| Members / Team | Екип |
| Account | Профил |
| Activity | Активност |
| Settings | Настройки |
| Notifications | Известия |
| Sign in / Sign up / Sign out | Вход / Регистрация / Изход |
| Owner / Accountant | Собственик / Счетоводител |
| Notes / Internal comment | Бележки / Вътрешен коментар |
| Status | Статус |
| Actions | Действия |
| Filters | Филтри |
| All | Всички |

## States / misc
| EN | BG |
|---|---|
| Loading… | Зареждане… |
| No results / No data | Няма резултати / Няма данни |
| Required | Задължително |
| Optional | По желание |
| Yes / No | Да / Не |
| Save / Cancel (dialog) | Запази / Отказ |
| Are you sure? | Сигурни ли сте? |
| Something went wrong | Възникна грешка |

Notes: keep ЕИК/ДДС/IBAN/BIC/МОЛ as-is (BG abbreviations). "Анулирай" for invoice cancel
vs "Отказ" for dialog-cancel — distinct. Keep amounts/dates via existing formatters.
