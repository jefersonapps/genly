import { Dropdown } from "@/components/ui/Dropdown";
import { CATEGORIES, Category, convertUnit, UNITS } from "@/lib/unitConverterUtils";
import { useTheme } from "@/providers/ThemeProvider";
import { shadows } from "@/theme/shadows";
import { useRouter } from "expo-router";
import { ArrowDownUp, ChevronDown, ChevronLeft } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UnitConverterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [category, setCategory] = useState<Category>("Comprimento");
  
  const [fromUnitId, setFromUnitId] = useState<string>(UNITS["Comprimento"][2].id); // Metro
  const [toUnitId, setToUnitId] = useState<string>(UNITS["Comprimento"][3].id);     // Quilômetro
  
  const [fromValue, setFromValue] = useState<string>("1");
  const [toValue, setToValue] = useState<string>("");

  const [rates, setRates] = useState<Record<string, number>>({});
  const [fetchingRates, setFetchingRates] = useState(false);

  // Fetch currency rates if necessary
  useEffect(() => {
    if (category === "Moedas" && Object.keys(rates).length === 0) {
      setFetchingRates(true);
      fetch("https://open.er-api.com/v6/latest/USD")
        .then(res => res.json())
        .then(data => {
            if (data && data.rates) setRates(data.rates);
        })
        .catch(err => console.error("Error fetching rates", err))
        .finally(() => setFetchingRates(false));
    }
  }, [category]);

  // Handle category change
  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    const units = UNITS[cat];
    if (units.length >= 2) {
      setFromUnitId(units[0].id);
      setToUnitId(units[1].id);
    } else {
      setFromUnitId(units[0].id);
      setToUnitId(units[0].id);
    }
  };

  // Convert logic
  useEffect(() => {
    const val = parseFloat(fromValue.replace(",", "."));
    if (isNaN(val)) {
        setToValue("");
        return;
    }
    const res = convertUnit(val, fromUnitId, toUnitId, category, rates);
    if (res !== null) {
        // format nicely to max 6 decimals
        let str = parseFloat(res.toFixed(6)).toString();
        setToValue(str);
    } else {
        setToValue("");
    }
  }, [fromValue, fromUnitId, toUnitId, category, rates]);

  // Swap units
  const handleSwap = () => {
    const tempId = fromUnitId;
    setFromUnitId(toUnitId);
    setToUnitId(tempId);
  };

  const currentUnits = UNITS[category];
  const fromUnit = currentUnits.find(u => u.id === fromUnitId);
  const toUnit = currentUnits.find(u => u.id === toUnitId);

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-outline/10">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary/50"
        >
          <ChevronLeft size={24} color={isDark ? "#FFF" : "#000"} />
        </TouchableOpacity>
        <Text className="font-sans-bold text-lg text-on-surface">Conversor de Medidas</Text>
        <View className="w-10" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        
        {/* Categories Pill Layout */}
        <View className="py-2 mt-2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                {CATEGORIES.map(c => (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        key={c}
                        onPress={() => handleCategoryChange(c)}
                        style={{ backgroundColor: category === c ? primaryColor : (isDark ? "#2A2A2A" : "#F0F0F0") }}
                        className="px-4 py-2 rounded-full"
                    >
                        <Text style={{ color: category === c ? "#FFF" : (isDark ? "#CCC" : "#333") }} className="font-sans-medium">
                            {c}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        {/* Currency Rates Loading Indicator */}
        {category === "Moedas" && fetchingRates && (
            <View className="flex-row items-center justify-center py-2 gap-2">
                <ActivityIndicator size="small" color={primaryColor} />
                <Text className="font-sans text-sm text-on-surface-secondary">Atualizando cotações...</Text>
            </View>
        )}

        {/* Converter Layout */}
        <View className="mx-4 mt-6 rounded-3xl p-4" style={{ backgroundColor: isDark ? "#1C1C1E" : "#F8F8F8" }}>
            
            {/* From Section */}
            <View className="rounded-2xl bg-surface p-4" style={{ borderWidth: 1, borderColor: isDark ? "#333" : "#E5E5E5" }}>
                <Text className="font-sans-medium text-xs text-on-surface-secondary mb-2 uppercase tracking-widest">Converter de</Text>
                
                <View className="flex-row items-center justify-between">
                    <TextInput 
                        value={fromValue}
                        onChangeText={setFromValue}
                        keyboardType="numeric"
                        className="flex-1 font-sans-bold text-3xl text-on-surface p-0 m-0"
                        placeholder="0"
                        placeholderTextColor={isDark ? "#555" : "#AAA"}
                        maxLength={15}
                    />

                    <Dropdown>
                        <Dropdown.Trigger>
                            <TouchableOpacity activeOpacity={0.8} className="flex-row items-center justify-between rounded-xl px-3 py-2 bg-surface-secondary ml-4">
                                <Text className="font-sans-medium text-sm text-on-surface mr-2 max-w-[100px]" numberOfLines={1}>
                                    {fromUnit?.symbol || fromUnit?.name}
                                </Text>
                                <ChevronDown size={14} color={isDark ? "#FFF" : "#000"} />
                            </TouchableOpacity>
                        </Dropdown.Trigger>
                        <Dropdown.Content width={220} align="end">
                            <ScrollView style={{ maxHeight: 300 }} indicatorStyle={isDark ? "white" : "black"}>
                                {currentUnits.map(u => (
                                    <Dropdown.Item 
                                        key={u.id}
                                        label={`${u.name} (${u.symbol})`}
                                        onPress={() => setFromUnitId(u.id)}
                                    />
                                ))}
                            </ScrollView>
                        </Dropdown.Content>
                    </Dropdown>
                </View>
                <Text className="font-sans text-sm text-on-surface-secondary mt-2">
                   {fromUnit?.name}
                </Text>
            </View>

            {/* Swap Button */}
            <View className="items-center -my-3 z-10">
                <TouchableOpacity 
                    activeOpacity={0.8}
                    onPress={handleSwap}
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={[{ backgroundColor: isDark ? "#2A2A2A" : "#FFFFFF", borderWidth: 1, borderColor: isDark ? "#444" : "#E5E5E5" }, shadows.sm]}
                >
                    <ArrowDownUp size={18} color={primaryColor} />
                </TouchableOpacity>
            </View>

            {/* To Section */}
            <View className="rounded-2xl bg-surface p-4" style={{ borderWidth: 1, borderColor: isDark ? "#333" : "#E5E5E5" }}>
                <Text className="font-sans-medium text-xs text-on-surface-secondary mb-2 uppercase tracking-widest">Para</Text>
                
                <View className="flex-row items-center justify-between">
                    <TextInput 
                        value={toValue}
                        editable={false}
                        className="flex-1 font-sans-bold text-3xl text-on-surface p-0 m-0 opacity-80"
                        placeholder="0"
                        placeholderTextColor={isDark ? "#555" : "#AAA"}
                    />

                    <Dropdown>
                        <Dropdown.Trigger>
                            <TouchableOpacity activeOpacity={0.8} className="flex-row items-center justify-between rounded-xl px-3 py-2 bg-surface-secondary ml-4">
                                <Text className="font-sans-medium text-sm text-on-surface mr-2 max-w-[100px]" numberOfLines={1}>
                                    {toUnit?.symbol || toUnit?.name}
                                </Text>
                                <ChevronDown size={14} color={isDark ? "#FFF" : "#000"} />
                            </TouchableOpacity>
                        </Dropdown.Trigger>
                        <Dropdown.Content width={220} align="end">
                            <ScrollView style={{ maxHeight: 300 }} indicatorStyle={isDark ? "white" : "black"}>
                                {currentUnits.map(u => (
                                    <Dropdown.Item 
                                        key={u.id}
                                        label={`${u.name} (${u.symbol})`}
                                        onPress={() => setToUnitId(u.id)}
                                    />
                                ))}
                            </ScrollView>
                        </Dropdown.Content>
                    </Dropdown>
                </View>
                <Text className="font-sans text-sm text-on-surface-secondary mt-2">
                   {toUnit?.name}
                </Text>
            </View>

        </View>

      </ScrollView>
    </View>
  );
}
