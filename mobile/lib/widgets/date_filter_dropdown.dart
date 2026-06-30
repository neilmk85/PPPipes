import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

const bizDatePresets = [
  ('today',        'Today'),
  ('yesterday',    'Yesterday'),
  ('this_week',    'This Week'),
  ('last_week',    'Last Week'),
  ('this_month',   'This Month'),
  ('last_month',   'Last Month'),
  ('this_quarter', 'This Quarter'),
  ('this_year',    'This Year'),
];

DateTime bizResolveFrom(String key) {
  final n = DateTime.now();
  switch (key) {
    case 'today':        return DateTime(n.year, n.month, n.day);
    case 'yesterday':    return DateTime(n.year, n.month, n.day - 1);
    case 'this_week':    return n.subtract(Duration(days: n.weekday - 1));
    case 'last_week':    return n.subtract(Duration(days: n.weekday - 1 + 7));
    case 'this_month':   return DateTime(n.year, n.month, 1);
    case 'last_month':   return DateTime(n.year, n.month - 1, 1);
    case 'this_quarter': final q = (n.month - 1) ~/ 3; return DateTime(n.year, q * 3 + 1, 1);
    case 'this_year':    return DateTime(n.year, 1, 1);
    default:             return n.subtract(const Duration(days: 29));
  }
}

DateTime bizResolveTo(String key) {
  final n = DateTime.now();
  switch (key) {
    case 'yesterday':  return DateTime(n.year, n.month, n.day - 1);
    case 'last_week':  return n.subtract(Duration(days: n.weekday));
    case 'last_month': return DateTime(n.year, n.month, 0);
    default:           return n;
  }
}

class BizDateFilter {
  final String preset;
  final DateTime? from;
  final DateTime? to;
  const BizDateFilter({this.preset = '', this.from, this.to});

  bool get isActive => preset.isNotEmpty;

  String get label {
    const labels = {
      'today': 'Today', 'yesterday': 'Yesterday', 'this_week': 'This Week',
      'last_week': 'Last Week', 'this_month': 'This Month', 'last_month': 'Last Month',
      'this_quarter': 'This Quarter', 'this_year': 'This Year',
    };
    if (labels.containsKey(preset)) return labels[preset]!;
    if (preset == 'custom' && from != null && to != null) {
      return '${DateFormat('dd MMM').format(from!)} – ${DateFormat('dd MMM').format(to!)}';
    }
    return 'Date';
  }
}

class BizDateDropdown extends StatefulWidget {
  final LayerLink layerLink;
  final BizDateFilter filter;
  final void Function(BizDateFilter) onApply;
  final VoidCallback onDismiss;
  const BizDateDropdown({
    super.key,
    required this.layerLink,
    required this.filter,
    required this.onApply,
    required this.onDismiss,
  });

  @override
  State<BizDateDropdown> createState() => _BizDateDropdownState();
}

class _BizDateDropdownState extends State<BizDateDropdown> {
  static const _violet = Color(0xFF7C3AED);

  Future<void> _pickRange() async {
    final s = widget.filter;
    final initial = (s.preset == 'custom' && s.from != null && s.to != null)
        ? DateTimeRange(start: s.from!, end: s.to!) : null;
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020), lastDate: DateTime(2030),
      initialDateRange: initial,
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(colorScheme: const ColorScheme.light(primary: _violet, onPrimary: Colors.white, surface: Colors.white)),
        child: child!,
      ),
    );
    if (picked != null) {
      widget.onApply(BizDateFilter(preset: 'custom', from: picked.start, to: picked.end));
    }
  }

  void _applyPreset(String key) {
    widget.onApply(BizDateFilter(preset: key, from: bizResolveFrom(key), to: bizResolveTo(key)));
  }

  @override
  Widget build(BuildContext context) => Stack(children: [
    Positioned.fill(child: GestureDetector(onTap: widget.onDismiss, behavior: HitTestBehavior.translucent)),
    CompositedTransformFollower(
      link: widget.layerLink,
      showWhenUnlinked: false,
      targetAnchor: Alignment.bottomRight,
      followerAnchor: Alignment.topRight,
      offset: const Offset(0, 6),
      child: Material(
        elevation: 16,
        borderRadius: BorderRadius.circular(16),
        shadowColor: Colors.black26,
        child: Container(
          width: 232,
          constraints: const BoxConstraints(maxHeight: 480),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade100),
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 2),
                child: Text('QUICK RANGE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[400], letterSpacing: 1.2)),
              ),
              ...bizDatePresets.map((p) {
                final active = widget.filter.preset == p.$1;
                return InkWell(
                  onTap: () => _applyPreset(p.$1),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                    color: active ? _violet.withValues(alpha: 0.07) : null,
                    child: Row(children: [
                      Text(p.$2, style: TextStyle(fontSize: 13, fontWeight: active ? FontWeight.w700 : FontWeight.w500, color: active ? _violet : Colors.grey[700])),
                      if (active) ...[const Spacer(), const Icon(Icons.check, size: 13, color: _violet)],
                    ]),
                  ),
                );
              }),
              const Divider(height: 1, indent: 12, endIndent: 12),
              const SizedBox(height: 2),
              Builder(builder: (_) {
                final isActive = widget.filter.preset == 'custom';
                final hasRange = isActive && widget.filter.from != null && widget.filter.to != null;
                final label = hasRange
                    ? '${DateFormat('dd MMM yyyy').format(widget.filter.from!)} – ${DateFormat('dd MMM yyyy').format(widget.filter.to!)}'
                    : 'Custom Range';
                return InkWell(
                  onTap: _pickRange,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                    color: isActive ? _violet.withValues(alpha: 0.07) : null,
                    child: Row(children: [
                      Icon(Icons.date_range_outlined, size: 14, color: isActive ? _violet : Colors.grey[500]),
                      const SizedBox(width: 8),
                      Expanded(child: Text(label, style: TextStyle(fontSize: 13, fontWeight: hasRange ? FontWeight.w700 : FontWeight.w500, color: hasRange ? (isActive ? _violet : Colors.grey[800]) : Colors.grey[400]))),
                      Icon(Icons.chevron_right, size: 14, color: Colors.grey[400]),
                    ]),
                  ),
                );
              }),
              if (widget.filter.isActive) ...[
                const SizedBox(height: 4),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: SizedBox(
                    width: double.infinity,
                    child: TextButton(
                      onPressed: () => widget.onApply(const BizDateFilter()),
                      style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 7), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                      child: const Text('Clear Filter', style: TextStyle(color: _violet, fontSize: 13)),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 4),
            ]),
          ),
        ),
      ),
    ),
  ]);
}
